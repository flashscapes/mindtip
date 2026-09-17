// DESTINATION: src/voice.ts
//
// Everything client-side for the hands-free voice loop, in one file:
//   - speakText()              text -> speech via /api/speak, plays it
//   - VoiceActivityDetector    watches the mic, hands back a clip once
//                              the user starts then stops talking
//   - useVoiceConversation()   the React hook wiring both into a loop:
//                              speak -> auto-listen -> transcribe ->
//                              hand text back to your app -> repeat

import { useCallback, useEffect, useRef, useState } from 'react';

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

async function fetchSpeechBlob(sentence: string, voiceKey?: string): Promise<Blob> {
  const params = new URLSearchParams({ text: sentence });
  if (voiceKey) params.set('voice', voiceKey);
  // Without this, a single hung request (no error, just never resolving)
  // makes the whole playback loop wait on it forever, since the loop
  // awaits each sentence's blob in order — every sentence after the stuck
  // one would silently never play, with no error ever surfacing anywhere.
  // This is very likely the actual mechanism behind longer replies
  // stopping partway through with no error shown.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(`/api/speak?${params.toString()}`, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`TTS fetch failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
    const blob = await res.blob();
    if (blob.size === 0) throw new Error('TTS response was empty (0 bytes)');
    return blob;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('TTS request timed out after 12s');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
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
async function speakText(text: string, voiceKey?: string, onDebug?: (msg: string) => void): Promise<void> {
  const requestId = ++currentRequestId;
  const sentences = splitIntoSentences(text);
  onDebug?.(`Requesting speech for ${sentences.length} sentence(s) in parallel…`);

  const blobPromises = sentences.map(s =>
    fetchSpeechBlob(s, voiceKey).catch(err => {
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
    try {
      const audio = getSharedAudio();
      audio.src = url;
      await new Promise<void>((resolve, reject) => {
        const stuckTimeout = setTimeout(() => reject(new Error('Playback did not finish within 30s')), 30000);
        audio.onended = () => {
          clearTimeout(stuckTimeout);
          resolve();
        };
        audio.onerror = () => {
          clearTimeout(stuckTimeout);
          reject(new Error(`Audio playback failed: ${audio.error?.message ?? 'unknown'}`));
        };
        audio.play().then(() => onDebug?.(`Segment ${i + 1} playing`)).catch((err) => {
          clearTimeout(stuckTimeout);
          reject(err);
        });
      });
    } catch (err) {
      // A playback error on one segment (a real, observed failure mode —
      // the shared <audio> element being reused rapidly across segments)
      // must not kill every sentence after it. Previously this threw all
      // the way out of the loop uncaught, which is exactly what made the
      // voice "just stop cold" partway through a reply with no error
      // surfaced — speakResponse's outer catch only logs and moves on to
      // listening again, it never resumes the remaining segments.
      onDebug?.(`Segment ${i + 1} playback failed, skipping: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Segment playback failed:', err);
    } finally {
      URL.revokeObjectURL(url);
    }
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
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
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
      silenceDurationMs: opts.silenceDurationMs ?? 3200,
      minSpeechDurationMs: opts.minSpeechDurationMs ?? 250,
    };
  }

  // Refactored to accept a shared, persistent AudioContext instead of
  // creating a fresh one every turn -- repeatedly creating/destroying
  // AudioContexts (not just getUserMedia streams) is the documented root
  // cause of iOS Safari's audio session degrading over a conversation,
  // eventually producing dead/silent mic streams that Whisper hallucinates
  // plausible-sounding garbage from, or that never register speech at all.
  // Only the per-turn MediaStream and its source/analyser nodes are still
  // created and torn down per turn -- the AudioContext itself now lives
  // for the whole voice-enabled session (owned by the hook, see
  // getSharedAudioContext below).
  async start(audioCtx: AudioContext): Promise<void> {
    // Defensive: iOS can suspend a context that's gone unused for a bit
    // (e.g. during TTS playback on the separate <audio> element) --
    // resuming a context that's already running is a harmless no-op.
    if (audioCtx.state === 'suspended') {
      try {
        await audioCtx.resume();
      } catch {
        // Best-effort -- if this fails, the getUserMedia call below will
        // surface the real error anyway.
      }
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.opts.onDebug(`Mic stream acquired: ${this.stream.getAudioTracks().length} audio track(s), enabled=${this.stream.getAudioTracks()[0]?.enabled}`);
    this.sourceNode = audioCtx.createMediaStreamSource(this.stream);
    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.sourceNode.connect(this.analyser);

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
    const chunks = this.chunks;
    recorder.onstop = async () => {
      // Fully release this turn's mic stream and AudioContext before
      // handing off — onSpeechEnd may itself trigger a fresh listen cycle,
      // and that next cycle's getUserMedia/AudioContext should never race
      // against this one still finishing its teardown.
      await this.teardown();
      const blob = new Blob(chunks, { type: 'audio/webm' });
      this.opts.onDebug(`Recorded blob: ${blob.size} bytes`);
      this.opts.onSpeechEnd(blob, durationMs);
    };
    recorder.stop();
  }

  stop(): void {
    this.teardown();
  }

  private teardown(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    // Disconnecting these matters now that the AudioContext itself is
    // long-lived (shared across the whole voice session, not recreated
    // per turn) -- without this, every turn would leave its old source
    // and analyser nodes still attached to the shared context, and a long
    // conversation would accumulate an ever-growing, never-cleaned audio
    // graph on that one context for its entire lifetime.
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    this.stream = null;
    this.sourceNode = null;
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
  // Created once per voice-enabled session and reused for every listen
  // turn — see VoiceActivityDetector's constructor comment for why:
  // recreating an AudioContext per turn is the documented root cause of
  // iOS Safari's audio session degrading over a conversation.
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getSharedAudioContext = (): AudioContext => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  };

  const startListening = useCallback((isRetry = false) => {
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
    Promise.race([vad.start(getSharedAudioContext()), micTimeout]).catch((err) => {
      logDebug(`Mic access failed: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Mic access failed:', err);
      // A single automatic retry — a transient mic/AudioContext hiccup
      // between turns (e.g. the previous turn's resources not fully
      // released yet) is common enough on mobile that silently stranding
      // the conversation at idle after one failure is worse than trying
      // once more. If the retry also fails, give up and surface idle so
      // at minimum the UI reflects reality rather than looking hung.
      if (!isRetry && enabledRef.current) {
        logDebug('Retrying mic access once…');
        setTimeout(() => startListening(true), 400);
      } else {
        setState('idle');
      }
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
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
  }, []);

  /** Call whenever MindTip has a new response. Auto-starts listening when done speaking. */
  const speakResponse = useCallback(
    async (text: string, voiceKey?: string) => {
      if (!enabledRef.current) {
        logDebug('speakResponse called but voice is not enabled — skipped');
        return;
      }
      setState('speaking');
      try {
        await speakText(text, voiceKey, logDebug);
      } catch (err) {
        logDebug(`Error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Speech playback failed:', err);
      }
      startListening();
    },
    [startListening]
  );

  // Safety net: this hook has no other tie to the component's lifecycle, so
  // without this, exiting a conversation (or any other unmount) leaves the
  // mic stream, AudioContext, and requestAnimationFrame monitor loop from
  // this instance running in the browser indefinitely -- raw browser APIs
  // like these don't stop just because the React component that created
  // them went away. That's exactly what let a second conversation's voice
  // loop start on top of a first one that was never actually torn down.
  // handleExit calling disableVoiceConversation() explicitly is the primary
  // fix; this covers every other way the component could unmount.
  useEffect(() => {
    return () => {
      enabledRef.current = false;
      vadRef.current?.stop();
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
      audioCtxRef.current = null;
    };
  }, []);

  return { state, enabled, debugLog, enableVoiceConversation, disableVoiceConversation, speakResponse, startListening };
}
