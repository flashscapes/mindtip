// DESTINATION: src/voice.ts
//
// Everything client-side for the hands-free voice loop, in one file:
//   - speakText()              text -> speech via /api/speak, plays it
//   - VoiceActivityDetector    watches the mic, hands back a clip once
//                              the user starts then stops talking
//   - useVoiceConversation()   the React hook wiring both into a loop:
//                              speak -> auto-listen -> transcribe ->
//                              hand text back to your app -> repeat

import { useCallback, useRef, useState } from 'react';

// ---------- Text-to-speech ----------

let sharedAudioEl: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
    sharedAudioEl.playsInline = true;
  }
  return sharedAudioEl;
}

/** Call synchronously inside a real tap, once per session, to unlock audio playback. */
export function unlockAudio(): void {
  const audio = getSharedAudio();
  audio.muted = true;
  audio.src = 'data:audio/mp3;base64,//uQx';
  audio.play().catch(() => {});
  audio.pause();
  audio.muted = false;
}

let currentRequestId = 0;

/** Fetches speech for `text` from /api/speak, plays it, resolves when playback ends. */
async function speakText(text: string): Promise<void> {
  const requestId = ++currentRequestId;
  const res = await fetch(`/api/speak?text=${encodeURIComponent(text)}`);
  if (!res.ok) throw new Error(`TTS fetch failed: ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  if (requestId !== currentRequestId) return; // superseded while fetching

  const audio = getSharedAudio();
  audio.src = url;
  await new Promise<void>((resolve, reject) => {
    audio.onended = () => resolve();
    audio.onerror = () => reject(new Error('Audio playback failed'));
    audio.play().catch(reject);
  });
}

// ---------- Voice activity detection ----------

interface VadOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audioBlob: Blob) => void;
  silenceThreshold?: number;
  silenceDurationMs?: number;
}

class VoiceActivityDetector {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private speaking = false;
  private silenceStart: number | null = null;
  private rafId: number | null = null;
  private opts: Required<VadOptions>;

  constructor(opts: VadOptions = {}) {
    this.opts = {
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
      silenceThreshold: opts.silenceThreshold ?? 12,
      silenceDurationMs: opts.silenceDurationMs ?? 1200,
    };
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    this.recorder = new MediaRecorder(this.stream, { mimeType: 'audio/webm' });
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.speaking = false;
    this.silenceStart = null;
    this.recorder.start();
    this.monitor();
  }

  private monitor = (): void => {
    if (!this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (const value of data) {
      const centered = value - 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const now = performance.now();

    if (rms > this.opts.silenceThreshold) {
      if (!this.speaking) {
        this.speaking = true;
        this.opts.onSpeechStart();
      }
      this.silenceStart = null;
    } else if (this.speaking) {
      if (this.silenceStart === null) {
        this.silenceStart = now;
      } else if (now - this.silenceStart > this.opts.silenceDurationMs) {
        this.finishTurn();
        return;
      }
    }
    this.rafId = requestAnimationFrame(this.monitor);
  };

  private finishTurn(): void {
    if (!this.recorder) return;
    const recorder = this.recorder;
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.opts.onSpeechEnd(blob);
    };
    recorder.stop();
    this.teardown();
  }

  stop(): void {
    this.teardown();
  }

  private teardown(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.audioCtx?.close();
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.recorder = null;
  }
}

// ---------- The hook that ties it all together ----------

type ConversationState = 'idle' | 'speaking' | 'listening' | 'transcribing';

interface UseVoiceConversationOptions {
  onUserSpeech: (transcript: string) => void;
}

/**
 * Usage:
 *   const voice = useVoiceConversation({ onUserSpeech: sendMessage });
 *   <button onClick={voice.enableVoiceConversation}>Start voice chat</button>
 *   voice.speakResponse(aiResponseText); // call whenever you get a new AI reply
 *   // voice.state is 'idle' | 'speaking' | 'listening' | 'transcribing'
 */
export function useVoiceConversation({ onUserSpeech }: UseVoiceConversationOptions) {
  const [state, setState] = useState<ConversationState>('idle');
  const [enabled, setEnabled] = useState(false);
  const enabledRef = useRef(false);
  const vadRef = useRef<VoiceActivityDetector | null>(null);

  const startListening = useCallback(() => {
    if (!enabledRef.current) return;
    setState('listening');

    const vad = new VoiceActivityDetector({
      onSpeechEnd: async (blob) => {
        setState('transcribing');
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: blob });
          const { text } = (await res.json()) as { text?: string };
          if (text && text.trim()) {
            onUserSpeech(text.trim());
          } else {
            startListening();
          }
        } catch (err) {
          console.error('Transcription failed:', err);
          startListening();
        }
      },
    });

    vadRef.current = vad;
    vad.start().catch((err) => {
      console.error('Mic access failed:', err);
      setState('idle');
    });
  }, [onUserSpeech]);

  /** Call once, from a real tap. Grants mic access and unlocks audio for the whole session. */
  const enableVoiceConversation = useCallback(async () => {
    unlockAudio();
    await navigator.mediaDevices.getUserMedia({ audio: true });
    enabledRef.current = true;
    setEnabled(true);
  }, []);

  const disableVoiceConversation = useCallback(() => {
    vadRef.current?.stop();
    enabledRef.current = false;
    setEnabled(false);
    setState('idle');
  }, []);

  /** Call whenever MindTip has a new response. Auto-starts listening when done speaking. */
  const speakResponse = useCallback(
    async (text: string) => {
      if (!enabledRef.current) return;
      setState('speaking');
      try {
        await speakText(text);
      } catch (err) {
        console.error('Speech playback failed:', err);
      }
      startListening();
    },
    [startListening]
  );

  return { state, enabled, enableVoiceConversation, disableVoiceConversation, speakResponse };
}
