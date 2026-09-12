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
    sharedAudioEl.setAttribute('playsinline', 'true');
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

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.!?]+[.!?]+(\s+|$)/g);
  if (!matches || matches.length === 0) return [text];
  return matches.map(s => s.trim()).filter(Boolean);
}

async function fetchSpeechBlob(sentence: string): Promise<Blob> {
  const res = await fetch(`/api/speak?text=${encodeURIComponent(sentence)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TTS fetch failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const blob = await res.blob();
  if (blob.size === 0) throw new Error('TTS response was empty (0 bytes)');
  return blob;
}

/** Splits `text` into sentences and fetches speech for ALL of them in
 *  parallel immediately — this is what actually cuts time-to-first-audio.
 *  Previously the entire reply was sent as one TTS request, so a
 *  multi-sentence reply couldn't start playing until the whole thing had
 *  been converted to speech. Now the first (usually short) sentence starts
 *  playing as soon as it's ready, while the rest are already generating in
 *  the background — by the time sentence 1 finishes playing, sentence 2 is
 *  very likely already done fetching. Plays strictly in order regardless
 *  of which fetch resolves first. */
async function speakText(text: string, onDebug?: (msg: string) => void): Promise<void> {
  const requestId = ++currentRequestId;
  const sentences = splitIntoSentences(text);
  onDebug?.(`Requesting speech for ${sentences.length} sentence(s) in parallel…`);

  const blobPromises = sentences.map(s =>
    fetchSpeechBlob(s).catch(err => {
      onDebug?.(`Segment fetch failed, skipping: ${err.message}`);
      return null;
    })
  );

  for (let i = 0; i < sentences.length; i++) {
    if (requestId !== currentRequestId) return; // superseded by a newer response — stop advancing
    const blob = await blobPromises[i];
    if (requestId !== currentRequestId) return;
    if (!blob) continue; // one segment failing shouldn't silence the rest of the reply

    onDebug?.(`Segment ${i + 1}/${sentences.length}: ${blob.size} bytes`);
    const url = URL.createObjectURL(blob);
    const audio = getSharedAudio();
    audio.src = url;
    await new Promise<void>((resolve, reject) => {
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error(`Audio playback failed: ${audio.error?.message ?? 'unknown'}`));
      audio.play().then(() => onDebug?.(`Segment ${i + 1} playing`)).catch(reject);
    });
  }
}

// ---------- Voice activity detection ----------

interface VadOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audioBlob: Blob, durationMs: number) => void;
  onDebug?: (msg: string) => void;
  silenceThreshold?: number; // amplitude (0-128 scale) below which is "quiet"
  silenceDurationMs?: number; // how long quiet must persist before ending the turn
  minSpeechDurationMs?: number; // how long amplitude must stay elevated before it counts as real speech, not a blip
}

class VoiceActivityDetector {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private speaking = false;
  private aboveThresholdSince: number | null = null;
  private speechStartedAt: number | null = null;
  private silenceStart: number | null = null;
  private rafId: number | null = null;
  private lastDebugAt = 0;
  private opts: Required<VadOptions>;

  constructor(opts: VadOptions = {}) {
    this.opts = {
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
      onDebug: opts.onDebug ?? (() => {}),
      silenceThreshold: opts.silenceThreshold ?? 5,
      silenceDurationMs: opts.silenceDurationMs ?? 2000,
      minSpeechDurationMs: opts.minSpeechDurationMs ?? 250,
    };
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.opts.onDebug(`Mic stream acquired: ${this.stream.getAudioTracks().length} audio track(s), enabled=${this.stream.getAudioTracks()[0]?.enabled}`);
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    source.connect(this.analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    this.opts.onDebug(`Using MediaRecorder mimeType: "${mimeType || '(browser default)'}"`);
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data);
    };
    this.speaking = false;
    this.aboveThresholdSince = null;
    this.speechStartedAt = null;
    this.silenceStart = null;
    this.recorder.start();
    this.lastDebugAt = 0;
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

    // Throttled so we can see live mic levels without flooding — every ~500ms.
    if (now - this.lastDebugAt > 500) {
      this.lastDebugAt = now;
      this.opts.onDebug(`Mic level: ${rms.toFixed(1)} (threshold ${this.opts.silenceThreshold}), speaking=${this.speaking}`);
    }

    if (rms > this.opts.silenceThreshold) {
      if (this.aboveThresholdSince === null) {
        this.aboveThresholdSince = now;
      }
      // Only count this as real speech once amplitude has stayed elevated
      // continuously for minSpeechDurationMs — a single loud frame (a tap,
      // a click, a stray noise) shouldn't be enough on its own.
      if (!this.speaking && now - this.aboveThresholdSince > this.opts.minSpeechDurationMs) {
        this.speaking = true;
        this.speechStartedAt = this.aboveThresholdSince;
        this.opts.onDebug('Speech detected — recording turn');
        this.opts.onSpeechStart();
      }
      this.silenceStart = null;
    } else {
      this.aboveThresholdSince = null;
      if (this.speaking) {
        if (this.silenceStart === null) {
          this.silenceStart = now;
        } else if (now - this.silenceStart > this.opts.silenceDurationMs) {
          this.opts.onDebug('Silence held long enough — ending turn');
          this.finishTurn();
          return;
        }
      }
    }
    this.rafId = requestAnimationFrame(this.monitor);
  };

  private finishTurn(): void {
    if (!this.recorder) return;
    const durationMs = this.speechStartedAt !== null ? performance.now() - this.speechStartedAt : 0;
    this.opts.onDebug(`Turn finished: ${durationMs.toFixed(0)}ms of speech, ${this.chunks.length} chunk(s) recorded`);
    const recorder = this.recorder;
    recorder.onstop = () => {
      const blob = new Blob(this.chunks, { type: 'audio/webm' });
      this.opts.onDebug(`Recorded blob: ${blob.size} bytes`);
      this.opts.onSpeechEnd(blob, durationMs);
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
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const logDebug = useCallback((msg: string) => {
    const t = new Date().toISOString().slice(11, 19);
    setDebugLog(prev => [...prev.slice(-24), `${t} ${msg}`]);
  }, []);
  const enabledRef = useRef(false);
  const vadRef = useRef<VoiceActivityDetector | null>(null);

  const startListening = useCallback(() => {
    if (!enabledRef.current) return;
    setState('listening');
    logDebug('Listening for your voice…');

    const vad = new VoiceActivityDetector({
      onDebug: logDebug,
      onSpeechEnd: async (blob, durationMs) => {
        // A clip shorter than this is almost certainly a noise blip, not a
        // word — sending it to Whisper risks a hallucinated transcription
        // (a known failure mode on near-silent audio), which would then get
        // treated as a real reply and loop the conversation on nothing said.
        const MIN_CLIP_MS = 400;
        if (durationMs < MIN_CLIP_MS) {
          logDebug(`Clip too short (${durationMs.toFixed(0)}ms) — listening again`);
          startListening();
          return;
        }

        setState('transcribing');
        logDebug('Sending audio to /api/transcribe…');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await fetch('/api/transcribe', { method: 'POST', body: blob, signal: controller.signal });
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            logDebug(`Transcribe failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
            startListening();
            return;
          }
          const { text } = (await res.json()) as { text?: string };
          logDebug(`Transcribed: "${text ?? '(empty)'}"`);
          if (text && text.trim()) {
            onUserSpeech(text.trim());
          } else {
            startListening();
          }
        } catch (err) {
          const isTimeout = err instanceof Error && err.name === 'AbortError';
          logDebug(isTimeout ? 'Transcription timed out after 15s — listening again' : `Transcription error: ${err instanceof Error ? err.message : String(err)}`);
          if (!isTimeout) console.error('Transcription failed:', err);
          startListening();
        } finally {
          clearTimeout(timeoutId);
        }
      },
    });

    vadRef.current = vad;
    const micTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Mic access timed out after 10s')), 10000)
    );
    Promise.race([vad.start(), micTimeout]).catch((err) => {
      logDebug(`Mic access failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Mic access failed:', err);
      setState('idle');
    });
  }, [onUserSpeech]);

  /** Call once, from a real tap. Unlocks audio for the whole session — actual
   *  mic access happens lazily on the first real startListening() call, which
   *  already requests and handles it correctly on its own. This used to also
   *  call getUserMedia() here, but that stream was discarded immediately and
   *  never used for anything — it just meant every voice-enabled conversation
   *  silently asked for the microphone twice in a row. */
  const enableVoiceConversation = useCallback(async () => {
    logDebug('Enabling voice: unlocking audio…');
    unlockAudio();
    enabledRef.current = true;
    setEnabled(true);
    logDebug('Voice enabled');
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
      if (!enabledRef.current) {
        logDebug('speakResponse called but voice is not enabled — skipped');
        return;
      }
      setState('speaking');
      try {
        await speakText(text, logDebug);
      } catch (err) {
        logDebug(`Error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Speech playback failed:', err);
      }
      startListening();
    },
    [startListening]
  );

  return { state, enabled, debugLog, enableVoiceConversation, disableVoiceConversation, speakResponse, startListening };
}
