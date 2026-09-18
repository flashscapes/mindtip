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
import { mark, markSegment, resetTurnTiming, finishTurnAndReport } from './voiceTiming';

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
  // Allows closing quotes/asterisks/parens/brackets between the terminal
  // punctuation and the whitespace-or-end check, e.g. a sentence ending in
  // `hooked."*` (a markdown-italicized quote) — without this, the period
  // there is immediately followed by `"*`, not whitespace or end-of-string,
  // so the original regex silently failed to match that whole sentence at
  // all. Confirmed directly: a real reported reply had its entire final
  // sentence vanish this way, mid-conversation, with zero errors anywhere,
  // because the code never knew that text existed in the first place.
  const matches = text.match(/[^.!?]+[.!?]+["'*)\]]*(\s+|$)/g);
  const sentences = (matches ?? []).map(s => s.trim()).filter(Boolean);

  // Defense in depth, not just a patch for this one pattern: verify the
  // matched sentences actually account for the input. If some other
  // punctuation edge case (that we haven't hit yet) causes the regex to
  // miss content again, recover whatever's left over as one more sentence
  // instead of silently dropping it — this class of bug should not be
  // able to recur even in a form not yet seen.
  const strip = (s: string) => s.replace(/\s+/g, '');
  const matchedLength = strip(sentences.join('')).length;
  const originalLength = strip(text).length;
  if (originalLength - matchedLength > 5) {
    let consumed = 0;
    for (const s of sentences) {
      const idx = text.indexOf(s, consumed);
      if (idx !== -1) consumed = idx + s.length;
    }
    const remainder = text.slice(consumed).trim();
    if (remainder) sentences.push(remainder);
  }

  return sentences.length > 0 ? sentences : [text];
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
  mark('sentence_ready');
  const sentences = splitIntoSentences(text);
  onDebug?.(`Requesting speech for ${sentences.length} sentence(s) in parallel…`);

  mark('tts_request_start');
  const blobPromises = sentences.map((s, i) => {
    markSegment(i, 'fetchStart');
    return fetchSpeechBlob(s, voiceKey)
      .then(blob => {
        markSegment(i, 'fetchEnd');
        if (i === 0) mark('tts_first_audio');
        return blob;
      })
      .catch(err => {
        onDebug?.(`Segment fetch failed, skipping: ${err.message}`);
        return null;
      });
  });

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
      markSegment(i, 'playStart');
      await new Promise<void>((resolve, reject) => {
        const stuckTimeout = setTimeout(() => reject(new Error('Playback did not finish within 30s')), 30000);
        audio.onended = () => {
          clearTimeout(stuckTimeout);
          markSegment(i, 'playEnd');
          resolve();
        };
        audio.onerror = () => {
          clearTimeout(stuckTimeout);
          reject(new Error(`Audio playback failed: ${audio.error?.message ?? 'unknown'}`));
        };
        audio.play().then(() => {
          if (i === 0) mark('playback_start');
          onDebug?.(`Segment ${i + 1} playing`);
        }).catch((err) => {
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
  private audioCtx: AudioContext | null = null;
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

  // Reverted from a shared/persistent AudioContext back to one created
  // fresh per turn. The persistent-context version was meant to fix a
  // documented iOS degradation pattern, but introduced a worse regression:
  // a context can end up 'suspended' during the "speaking" (TTS) phase,
  // and resuming an AudioContext from code that isn't directly inside a
  // user gesture handler is exactly the kind of thing Safari can silently
  // refuse -- which would leave the shared context permanently suspended,
  // meaning the analyser never sees real audio again and no turn is ever
  // detected as finished. That's total failure, strictly worse than the
  // intermittent degradation it was meant to address. This per-turn
  // approach is the known-working baseline; a real fix for the iOS
  // degradation issue needs to be verified on an actual device before
  // shipping again, not iterated on blind.
  async start(): Promise<void> {
    // Reverted an earlier experiment here that explicitly disabled
    // autoGainControl/echoCancellation/noiseSuppression. Evidence showed
    // it made things worse, not better: a brand-new conversation's very
    // first turn (not turn 7-8) came in with mic levels of 0.0-1.0, with
    // the disabled settings confirmed applied via getSettings(). Automatic
    // gain control's actual job is boosting quiet input to a usable
    // level -- disabling it likely removed something that was helping
    // normal speech register at all, rather than fixing the later-session
    // degradation it was meant to address. Back to browser defaults while
    // the real cause is still unknown.
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = this.stream.getAudioTracks()[0];
    this.opts.onDebug(
      `Mic stream acquired: ${this.stream.getAudioTracks().length} audio track(s), ` +
      `enabled=${track?.enabled}, muted=${track?.muted}, readyState=${track?.readyState}`
    );
    // Constraints are requested, not guaranteed -- confirm what the
    // browser actually negotiated before drawing any conclusion from the
    // experiment above.
    if (track) {
      const settings = track.getSettings();
      this.opts.onDebug(
        `Actual mic settings: autoGainControl=${settings.autoGainControl}, ` +
        `echoCancellation=${settings.echoCancellation}, noiseSuppression=${settings.noiseSuppression}`
      );
    }
    // enabled is script-controlled and this code never touches it, so it's
    // always true regardless of what's actually happening at the OS/
    // hardware level -- muted and readyState are the properties that would
    // actually reveal a dead/degraded stream. Logging any change live,
    // not just the state at acquisition, since the hypothesis is that a
    // stream can go bad *during* a session, not only fail to start.
    if (track) {
      track.onmute = () => this.opts.onDebug(`⚠ Mic track went MUTED mid-stream (readyState=${track.readyState})`);
      track.onunmute = () => this.opts.onDebug(`Mic track unmuted (readyState=${track.readyState})`);
      track.onended = () => this.opts.onDebug(`⚠ Mic track ENDED unexpectedly (readyState=${track.readyState})`);
    }
    this.audioCtx = new AudioContext();
    this.opts.onDebug(`AudioContext created: state=${this.audioCtx.state}`);
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
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
      // Confirmed via a captured real session: this used to reset
      // unconditionally on ANY crossing, including a single ~16ms frame
      // invisible in the 500ms-throttled debug log above. A momentary
      // noise blip (background hum, a creak) would fully zero out the
      // silence countdown every time it happened, so accumulated quiet
      // could never reach silenceDurationMs and the turn would hang
      // forever waiting for a "silence" that, from its perspective, kept
      // getting interrupted. Now a blip only clears the countdown once
      // it's persisted as long as real speech would have to, same bar as
      // starting a turn in the first place.
      if (this.speaking && now - this.aboveThresholdSince > this.opts.minSpeechDurationMs) {
        this.silenceStart = null;
      }
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
    resetTurnTiming();
    mark('mic_turn_end');
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
      mark('capture_finalized');
      this.opts.onDebug(`Recorded blob: ${blob.size} bytes`);
      this.opts.onSpeechEnd(blob, durationMs);
    };
    recorder.stop();
  }

  stop(): Promise<void> {
    return this.teardown();
  }

  private async teardown(): Promise<void> {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    // AudioContext.close() is genuinely async — awaiting it (instead of
    // firing and forgetting) means a fresh AudioContext for the next turn
    // never gets created before this one has actually finished releasing
    // its resources, which is a real risk on constrained mobile hardware.
    try {
      await this.audioCtx?.close();
    } catch {
      // Already closed or never fully opened — nothing to do.
    }
    this.stream = null;
    this.sourceNode = null;
    this.analyser = null;
    this.audioCtx = null;
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
  // Every logDebug call used to trigger setDebugLog directly, which is
  // React state -- meaning the entire Conversation screen re-rendered on
  // every single line, including frequent ones like the mic-level reading
  // (roughly 2x/second while listening), even with the debug panel
  // collapsed and nobody looking at it. That's real, ongoing overhead the
  // diagnostic instrumentation itself was adding on top of normal
  // conversation flow. This ref always holds the complete, immediate
  // history (nothing is lost); the visible React state is now synced from
  // it at most once a second, cutting re-render frequency drastically
  // while console.log (not React-tracked, effectively free) still fires
  // instantly every time for anyone watching the console live.
  const debugBufferRef = useRef<string[]>([]);
  const debugFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logDebug = useCallback((msg: string) => {
    const t = new Date().toISOString().slice(11, 19);
    const line = `${t} ${msg}`;
    console.log('[voice]', line);
    debugBufferRef.current = [...debugBufferRef.current.slice(-59), line];
    if (debugFlushTimerRef.current === null) {
      debugFlushTimerRef.current = setTimeout(() => {
        debugFlushTimerRef.current = null;
        setDebugLog(debugBufferRef.current);
      }, 1000);
    }
  }, []);
  const enabledRef = useRef(false);
  // Purely diagnostic: lets every log line below be tied to a specific
  // exchange number, so a failure can be directly correlated against the
  // reported "works for 8-10 exchanges, then stops" pattern instead of
  // just guessing at which turn things went wrong.
  const turnCountRef = useRef(0);
  const vadRef = useRef<VoiceActivityDetector | null>(null);

  const startListening = useCallback((isRetry = false, noSpeechRetryCount = 0) => {
    if (!enabledRef.current) return;
    setState('listening');
    if (!isRetry && noSpeechRetryCount === 0) turnCountRef.current += 1;
    logDebug(`Listening for your voice… (turn #${turnCountRef.current}${isRetry ? ', mic retry' : ''}${noSpeechRetryCount > 0 ? `, no-speech retry ${noSpeechRetryCount}` : ''})`);

    let noSpeechTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const vad = new VoiceActivityDetector({
      onDebug: logDebug,
      onSpeechStart: () => {
        // Real speech is happening — let the normal turn-ending logic
        // (silence after speech) take over instead of the watchdog.
        if (noSpeechTimeoutId !== null) {
          clearTimeout(noSpeechTimeoutId);
          noSpeechTimeoutId = null;
        }
      },
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
          mark('transcribe_request_start');
          const res = await fetch('/api/transcribe', { method: 'POST', body: blob, signal: controller.signal });
          if (!res.ok) {
            const body = await res.text().catch(() => '');
            logDebug(`Transcribe failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
            startListening();
            return;
          }
          const { text } = (await res.json()) as { text?: string };
          mark('transcribe_response');
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
    Promise.race([vad.start(), micTimeout])
      .then(() => {
        // Mic access succeeded and monitoring has begun. If no speech is
        // ever detected — including the case where getUserMedia silently
        // handed back a dead/muted stream, a real and observed mobile
        // failure mode that produces no error at all — this guarantees
        // the app doesn't just sit listening in total silence forever.
        // Tearing down and retrying gets a genuinely fresh getUserMedia
        // call, which has a real chance of recovering a working stream
        // even when the current one doesn't work, without needing to know
        // exactly why it didn't.
        // A normal long pause (the person is thinking, stepped away
        // briefly) must never be mistaken for a dead mic and trigger a
        // teardown/retry -- explicitly required to tolerate at least 40s
        // of silence before the user starts speaking. Set well above that
        // with real margin, not just barely over it.
        const NO_SPEECH_TIMEOUT_MS = 50000;
        const MAX_NO_SPEECH_RETRIES = 3;
        noSpeechTimeoutId = setTimeout(async () => {
          if (vadRef.current !== vad) return; // superseded by a newer listen cycle already
          logDebug(`No speech detected within ${NO_SPEECH_TIMEOUT_MS / 1000}s — retrying with a fresh mic stream`);
          await vad.stop();
          if (noSpeechRetryCount < MAX_NO_SPEECH_RETRIES && enabledRef.current) {
            startListening(false, noSpeechRetryCount + 1);
          } else {
            logDebug('No speech detected after repeated retries — giving up for now');
            setState('idle');
          }
        }, NO_SPEECH_TIMEOUT_MS);
      })
      .catch((err) => {
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
      finishTurnAndReport(logDebug);
      // EXPERIMENT: a captured log showed listening beginning the exact
      // instant playback ended -- zero gap between the speaker finishing
      // and the mic being asked to start capturing. Audio hardware
      // switching from output to input isn't always instantaneous; this
      // small pause gives that transition room to complete before the mic
      // stream is requested, rather than requesting it mid-switch. Clearly
      // labeled as an experiment, not a confirmed fix -- trivially
      // reversible (this one line) if it doesn't help.
      if (enabledRef.current) {
        await new Promise(resolve => setTimeout(resolve, 250));
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
      if (debugFlushTimerRef.current !== null) {
        clearTimeout(debugFlushTimerRef.current);
        debugFlushTimerRef.current = null;
      }
    };
  }, []);

  return { state, enabled, debugLog, logDebug, enableVoiceConversation, disableVoiceConversation, speakResponse, startListening };
}
