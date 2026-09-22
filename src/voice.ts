// DESTINATION: src/voice.ts
//
// Everything client-side for the hands-free voice loop, in one file:
//   - speakText()         text -> speech via /api/speak, plays it
//   - VoiceSession        owns ONE persistent mic/AudioContext/recorder
//                          for the whole conversation and detects turns
//                          within it (see the big comment above the class)
//   - useVoiceConversation()   the React hook wiring both into a loop:
//                              speak -> auto-listen -> transcribe ->
//                              hand text back to your app -> repeat
//
// ARCHITECTURE (rewritten from a per-turn design):
// Previously, every single turn constructed a brand-new mic stream,
// AudioContext, analyser, and MediaRecorder, then tore the whole thing
// down again once the turn finished -- "start a new microphone session"
// was, in effect, a synonym for "start a new turn." That meant every
// turn boundary was a fresh opportunity for mic-permission races,
// AudioContext-suspend/resume quirks, and an unguarded Promise.race
// (mic acquisition vs. a timeout) to leave something running that
// nothing would ever stop.
//
// Now there is ONE VoiceSession per conversation. Its mic stream,
// AudioContext, and MediaRecorder are created once (init()) and stay
// alive until voice is disabled. A "turn" is just resumeListening() /
// pauseListening() flipping a flag and resetting small per-turn buffers
// -- the underlying hardware pipeline is never rebuilt between turns.
// The one remaining rebuild path (a confirmed-dead mic track) is now an
// explicit, rare recovery action, not routine per-turn behavior, and is
// guarded against the same orphaned-instance race with a generation
// counter (see attemptInit() below).

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

// Whisper reliably emits a small set of stock phrases when handed
// near-silence — an artifact of being trained on captioned video, where
// these play over quiet outros. In practice a pause with a little
// incidental noise (paper, a breath, shifting in a chair) comes back as
// "Thank you." and then gets answered as if it were a real message,
// repeatedly.
//
// Deliberately matched against the ENTIRE transcript only: "thank you,
// that really helped" is untouched. The cost is that a bare "thank you"
// on its own is ignored and has to be repeated — accepted because the
// alternative (an energy-based check) is not viable here: measured from
// real session logs, genuine speech on this setup registers LOWER
// above-threshold energy than the noise that triggers these false turns,
// so any loudness test would start discarding real sentences.
const WHISPER_SILENCE_ARTIFACTS = new Set([
  'thank you',
  'thanks',
  'thank you very much',
  'thanks for watching',
  'thank you for watching',
  'you',
]);

function isWhisperSilenceArtifact(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length === 0 || WHISPER_SILENCE_ARTIFACTS.has(normalized);
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
export async function speakText(text: string, voiceKey?: string, onDebug?: (msg: string) => void): Promise<void> {
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

// ---------- Voice session (persistent mic/AudioContext + turn detection) ----------

interface VoiceSessionOptions {
  onSpeechStart?: () => void;
  onSpeechEnd?: (audioBlob: Blob, durationMs: number) => void;
  // Fired the moment the underlying mic track's readyState becomes
  // 'ended' — a real, permanent loss (most commonly iOS backgrounding the
  // tab), never a transient mute that might self-resolve. This is an
  // event, not a poll: real captured evidence showed it firing within ~4s
  // of the actual loss, while a 50s setTimeout-based watchdog checking the
  // same condition was delayed nearly 5 minutes by iOS's background timer
  // throttling. Acting on this directly, instead of waiting for that
  // timer, is what makes recovery actually prompt.
  onStreamLost?: () => void;
  onDebug?: (msg: string) => void;
  silenceThreshold?: number; // amplitude (0-128 scale) below which is "quiet"
  silenceDurationMs?: number; // how long quiet must persist before ending the turn
  minSpeechDurationMs?: number; // how long amplitude must stay elevated before it counts as real speech, not a blip
  minResumeDurationMs?: number; // shorter bar for recognizing speech has resumed mid-turn (interrupting an in-progress silence countdown) -- natural speech comes in short bursts between words, so this should be lower than the bar for starting a brand-new turn from silence, where being more conservative against false starts matters more
}

/**
 * Owns ONE microphone stream, ONE AudioContext, and ONE continuously-running
 * MediaRecorder for the entire lifetime of a voice conversation — not one
 * per turn (see the file-level comment above for why this changed).
 *
 * A turn is a lightweight state change: resumeListening() resets the
 * per-turn buffers and starts reacting to audio again; pauseListening()
 * stops reacting (AI is speaking, or a turn is being transcribed) without
 * releasing anything. The mic stays open and the AudioContext stays alive
 * the whole time.
 *
 * A previous version of this file used a persistent AudioContext and
 * reverted it after a real regression: the context could end up
 * 'suspended' during the TTS-playback phase, and resuming it from code not
 * directly inside a user-gesture handler is exactly the kind of thing
 * Safari can silently refuse — which would leave the shared context
 * permanently suspended and no turn ever detected again. Two things are
 * different this time, specifically to address that: (1) resumeListening()
 * re-checks and re-attempts resume() every single time we return to
 * LISTENING, not just once at startup, so a suspend that happens mid-TTS
 * gets a fresh resume attempt at the very next turn instead of being
 * assumed to have worked; (2) isHealthy() + the hook's watchdog give an
 * explicit, bounded escape hatch (a full reinit) if the mic/context is ever
 * confirmed stuck, instead of silently listening into a dead pipeline
 * forever. This has NOT been verified on an actual stuck-Safari-context
 * device yet — flag that specifically if it recurs.
 */
class VoiceSession {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private recorder: MediaRecorder | null = null;

  private chunks: Blob[] = [];
  // The MIME type MediaRecorder actually negotiated — NOT necessarily
  // 'audio/webm'. Safari on iOS doesn't support audio/webm at all, so
  // MediaRecorder silently falls back to its own default (audio/mp4).
  // Hardcoding 'audio/webm' on the resulting Blob regardless of what was
  // actually recorded produced a file labeled webm but containing mp4
  // bytes — which Groq correctly rejected as unparseable. Captured right
  // after the recorder is created so the real format is used everywhere
  // downstream (the Blob's type, and therefore the Content-Type header
  // fetch sends automatically).
  private recordedMimeType = 'audio/webm';
  // The container's init/header data (WebM's EBML+Segment+Tracks, or
  // MP4's ftyp+moov) is only ever present in the FIRST chunk MediaRecorder
  // emits after start() — and start() is only called once for the whole
  // session (see the class comment), not per turn. Every turn's Blob was
  // being built from `chunks`, which never contained that header chunk: it
  // arrives before resumeListening() is ever called (this.active is still
  // false), and the old ondataavailable handler dropped anything received
  // while inactive outright. The result was a headerless, structurally
  // invalid file handed to Groq every single turn — this is what Groq's
  // "could not process file" error was actually reporting. Captured once,
  // unconditionally, and explicitly prepended to every turn's Blob below.
  private headerChunk: Blob | null = null;
  // Small rolling buffer of chunks recorded while speech has not yet been
  // confirmed for the CURRENT turn — see resumeListening()/monitor() for
  // how it's filled, cleared, and consumed. Same pre-roll mechanism as
  // before; only its container (one long-lived session instead of a fresh
  // object per turn) changed.
  private preRollChunks: Blob[] = [];
  private static readonly TIMESLICE_MS = 100;
  private static readonly PRE_ROLL_CHUNK_COUNT = 3; // ~300ms at 100ms/chunk

  // Whether turn-detection is currently "on". True only while we actually
  // want to be listening for the user; false while a turn is being
  // processed or the AI is speaking. This is the ONLY thing that changes
  // between turns — the mic/AudioContext/recorder are untouched either way.
  private active = false;
  private speaking = false;
  private aboveThresholdSince: number | null = null;
  // When the signal most recently dropped below threshold, or null if the
  // last frame was above it. Real speech dips below threshold constantly
  // between syllables, and the old code reset aboveThresholdSince on the
  // very first such frame — so the "stay above threshold for
  // minSpeechDurationMs" requirement kept restarting from zero and took
  // ~6 SECONDS to ever be satisfied (measured: a window with 19 of 31
  // frames above threshold still had a longest unbroken run of only
  // 267ms). Tracking when the dip started lets a brief one ride through
  // instead, which is the standard hangover/hold behavior real voice
  // detectors use.
  private belowThresholdSince: number | null = null;
  // How long the signal must stay below threshold before an in-progress
  // onset actually counts as broken. Long enough for inter-syllable gaps,
  // short enough that two unrelated impulse noises (a click, a knock)
  // won't chain together into a false onset.
  private static readonly DIP_TOLERANCE_MS = 120;
  private speechStartedAt: number | null = null;
  private silenceStart: number | null = null;
  private rafId: number | null = null;
  private lastDebugAt = 0;

  // TEMPORARY DIAGNOSTIC ONLY — counts frame-level above/below-threshold
  // behavior within each ~500ms debug-log window, to verify whether brief
  // dips below silenceThreshold are what's preventing minSpeechDurationMs
  // from ever being reached. Remove once the VAD diagnosis is confirmed.
  private vadWindowFrames = 0;
  private vadWindowAbove = 0;
  private vadWindowBelow = 0;
  private vadCurrentRunFrames = 0;
  private vadLongestRunFrames = 0;
  private vadResetOccurred = false;
  private opts: Required<VoiceSessionOptions>;

  constructor(opts: VoiceSessionOptions = {}) {
    this.opts = {
      onSpeechStart: opts.onSpeechStart ?? (() => {}),
      onSpeechEnd: opts.onSpeechEnd ?? (() => {}),
      onStreamLost: opts.onStreamLost ?? (() => {}),
      onDebug: opts.onDebug ?? (() => {}),
      silenceThreshold: opts.silenceThreshold ?? 5,
      // Was 3200ms — a flat 3.2s of dead air after the person stopped
      // talking before anything was even sent for transcription, on top of
      // transcribe + AI + speech time. Cut to 1.8s, which is still a long
      // mid-sentence pause to tolerate, and the dip tolerance added above
      // makes resumed speech far better at clearing this countdown than it
      // was when 3.2s was chosen as protection against premature cutoffs.
      silenceDurationMs: opts.silenceDurationMs ?? 1800,
      minSpeechDurationMs: opts.minSpeechDurationMs ?? 250,
      minResumeDurationMs: opts.minResumeDurationMs ?? 100,
    };
  }

  /** Acquire the mic and stand up the audio pipeline ONCE for the whole
   *  conversation. Only called again (via a fresh instance) if isHealthy()
   *  later reports a confirmed-dead stream. */
  async init(): Promise<void> {
    this.opts.onDebug('[session] init() beginning');
    // Plain default constraints (no autoGainControl/echoCancellation/
    // noiseSuppression overrides). An earlier experiment disabled these
    // explicitly and made things measurably worse — a brand-new
    // conversation's very first turn came in at mic levels of 0.0-1.0 with
    // the disabled settings confirmed applied via getSettings(). Automatic
    // gain control's actual job is boosting quiet input to a usable level;
    // disabling it removed something that was helping normal speech
    // register at all.
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = this.stream.getAudioTracks()[0];
    this.opts.onDebug(
      `Mic stream acquired: ${this.stream.getAudioTracks().length} audio track(s), ` +
      `enabled=${track?.enabled}, muted=${track?.muted}, readyState=${track?.readyState}`
    );
    if (track) {
      const settings = track.getSettings();
      this.opts.onDebug(
        `Actual mic settings: autoGainControl=${settings.autoGainControl}, ` +
        `echoCancellation=${settings.echoCancellation}, noiseSuppression=${settings.noiseSuppression}`
      );
      track.onmute = () => this.opts.onDebug(`⚠ Mic track went MUTED mid-session (readyState=${track.readyState})`);
      track.onunmute = () => this.opts.onDebug(`Mic track unmuted (readyState=${track.readyState})`);
      // 'ended' is permanent — unlike 'muted' (which can self-resolve via
      // onunmute, e.g. a brief Siri/system-audio interruption), a track
      // that has ended will never produce data again. This is the
      // authoritative "the stream is actually gone" signal.
      track.onended = () => {
        this.opts.onDebug(`⚠ Mic track ENDED unexpectedly (readyState=${track.readyState})`);
        this.opts.onStreamLost();
      };
    }

    this.audioCtx = new AudioContext();
    this.opts.onDebug(`AudioContext created: state=${this.audioCtx.state}`);
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
      this.opts.onDebug(`AudioContext resume attempted: state=${this.audioCtx.state}`);
    }
    this.sourceNode = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    this.sourceNode.connect(this.analyser);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    this.opts.onDebug(`Using MediaRecorder mimeType: "${mimeType || '(browser default)'}"`);
    this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    // The browser fills in the actual negotiated type here regardless of
    // what (if anything) we requested — this is the ground truth, not the
    // request above. Falls back to 'audio/webm' only if the browser
    // somehow reports nothing at all.
    this.recordedMimeType = this.recorder.mimeType || 'audio/webm';
    this.opts.onDebug(`MediaRecorder actual negotiated mimeType: "${this.recordedMimeType}"`);
    this.chunks = [];
    this.preRollChunks = [];
    this.headerChunk = null;
    this.recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      // The very first chunk this recorder ever produces, unconditionally
      // — captured regardless of `active`, since it arrives before
      // resumeListening() is ever called for turn 1. See the headerChunk
      // field comment. Not fed into preRoll/chunks; it's prepended
      // explicitly in finishTurn() instead, exactly once per turn.
      if (this.headerChunk === null) {
        this.headerChunk = e.data;
        this.opts.onDebug(`Captured recorder header chunk: ${e.data.size} bytes`);
        return;
      }
      // Dropped outright while not actively listening (AI speaking /
      // processing a turn) — belt-and-suspenders alongside pause()/
      // resume() below, since MediaRecorder.pause() support has had rough
      // edges on some WebKit versions historically.
      if (!this.active) return;
      if (this.speaking) {
        this.chunks.push(e.data);
      } else {
        this.preRollChunks.push(e.data);
        if (this.preRollChunks.length > VoiceSession.PRE_ROLL_CHUNK_COUNT) {
          this.preRollChunks.shift();
        }
      }
    };
    this.recorder.start(VoiceSession.TIMESLICE_MS);
    this.active = false; // caller explicitly calls resumeListening() to begin the first turn
    this.lastDebugAt = 0;
    this.rafId = requestAnimationFrame(this.monitor);
    this.opts.onDebug('[session] init() completed — persistent mic/AudioContext/recorder now live for the whole conversation');
  }

  /** True if the underlying mic track still looks alive. Used by the
   *  hook's watchdog to tell a genuinely dead stream apart from the user
   *  just taking a long pause to think — the latter must never trigger a
   *  rebuild. */
  isHealthy(): boolean {
    const track = this.stream?.getAudioTracks()[0];
    return !!track && track.readyState === 'live' && !track.muted;
  }

  /** Begin/resume actively listening for the next turn. Resets per-turn
   *  state but does NOT touch the mic/AudioContext/recorder — they stay
   *  alive for the whole conversation. */
  resumeListening(): void {
    this.chunks = [];
    this.preRollChunks = [];
    this.speaking = false;
    this.aboveThresholdSince = null;
    this.belowThresholdSince = null;
    this.speechStartedAt = null;
    this.silenceStart = null;
    this.active = true;
    // Restart the monitor loop if it stopped. It stops exactly once per
    // completed turn (see monitor()'s turn-ending branch), so without this
    // every turn after the first speech turn listened into a loop that was
    // no longer running. Guarded on rafId so a still-running loop is never
    // double-scheduled into two concurrent loops.
    if (this.rafId === null && this.analyser) {
      this.rafId = requestAnimationFrame(this.monitor);
    }
    if (this.audioCtx?.state === 'suspended') {
      void this.audioCtx.resume();
    }
    try {
      if (this.recorder && this.recorder.state === 'paused') this.recorder.resume();
    } catch {
      // Not fatal — the `active` guard in ondataavailable/monitor keeps
      // behavior correct even if pause()/resume() itself is flaky here.
    }
  }

  /** Stop reacting to audio (AI is speaking, or a turn is being
   *  processed) without tearing anything down. */
  pauseListening(): void {
    this.active = false;
    try {
      if (this.recorder && this.recorder.state === 'recording') this.recorder.pause();
    } catch {
      // See resumeListening() — the active flag covers us either way.
    }
  }

  private monitor = (): void => {
    if (!this.analyser) return; // session torn down
    if (!this.active) {
      // Keep the loop alive (so we react instantly once resumeListening()
      // flips `active` back on) without doing any detection work meanwhile.
      this.rafId = requestAnimationFrame(this.monitor);
      return;
    }
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);

    let sumSquares = 0;
    for (const value of data) {
      const centered = value - 128;
      sumSquares += centered * centered;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    const now = performance.now();

    // TEMPORARY DIAGNOSTIC ONLY — see field comments above.
    this.vadWindowFrames++;
    if (rms > this.opts.silenceThreshold) {
      this.vadWindowAbove++;
      this.vadCurrentRunFrames++;
      if (this.vadCurrentRunFrames > this.vadLongestRunFrames) {
        this.vadLongestRunFrames = this.vadCurrentRunFrames;
      }
    } else {
      this.vadWindowBelow++;
      this.vadCurrentRunFrames = 0;
    }

    // Throttled so we can see live mic levels without flooding — every ~500ms.
    if (now - this.lastDebugAt > 500) {
      const windowElapsedMs = this.lastDebugAt === 0 ? 500 : now - this.lastDebugAt;
      this.lastDebugAt = now;
      this.opts.onDebug(`Mic level: ${rms.toFixed(1)} (threshold ${this.opts.silenceThreshold}), speaking=${this.speaking}`);
      // TEMPORARY DIAGNOSTIC ONLY — remove once VAD diagnosis is confirmed.
      const frameMs = this.vadWindowFrames > 0 ? windowElapsedMs / this.vadWindowFrames : 0;
      const longestRunMs = Math.round(this.vadLongestRunFrames * frameMs);
      this.opts.onDebug(
        `VAD window: ${this.vadWindowFrames} frames | above: ${this.vadWindowAbove} | below: ${this.vadWindowBelow} | ` +
        `longest above run: ${longestRunMs}ms | threshold: ${this.opts.silenceThreshold} | reset=${this.vadResetOccurred} | speaking=${this.speaking}`
      );
      this.vadWindowFrames = 0;
      this.vadWindowAbove = 0;
      this.vadWindowBelow = 0;
      this.vadLongestRunFrames = 0;
      this.vadResetOccurred = false;
    }

    if (rms > this.opts.silenceThreshold) {
      this.belowThresholdSince = null; // any loud frame clears a pending dip
      if (this.aboveThresholdSince === null) {
        this.aboveThresholdSince = now;
      }
      // Only count this as real speech once amplitude has stayed elevated
      // for minSpeechDurationMs — a single loud frame (a tap, a click, a
      // stray noise) shouldn't be enough on its own. "Elevated" tolerates
      // dips shorter than DIP_TOLERANCE_MS (see belowThresholdSince); it
      // used to demand an unbroken run, which real speech rarely produces.
      if (!this.speaking && now - this.aboveThresholdSince > this.opts.minSpeechDurationMs) {
        this.speaking = true;
        this.speechStartedAt = this.aboveThresholdSince;
        this.opts.onDebug(`Speech detected — recording turn (with ${this.preRollChunks.length} pre-roll chunk(s))`);
        this.chunks.push(...this.preRollChunks);
        this.preRollChunks = [];
        this.opts.onSpeechStart();
      }
      // Legitimate resumed speech (natural short word-bursts, not a
      // background-noise blip) uses a shorter bar to clear an in-progress
      // silence countdown than the bar for starting a brand-new turn —
      // normal speech doesn't always sustain 250ms continuously between
      // micro-pauses, and requiring that let an earlier pause's countdown
      // keep ticking uninterrupted even while the person was actively
      // talking, cutting off a genuine continuation.
      if (this.speaking && now - this.aboveThresholdSince > this.opts.minResumeDurationMs) {
        this.silenceStart = null;
      }
    } else {
      // A dip only breaks an in-progress onset once it has persisted for
      // DIP_TOLERANCE_MS — see the belowThresholdSince field comment for
      // why resetting on the first quiet frame made onset detection take
      // seconds instead of milliseconds.
      if (this.belowThresholdSince === null) {
        this.belowThresholdSince = now;
      } else if (now - this.belowThresholdSince > VoiceSession.DIP_TOLERANCE_MS) {
        // TEMPORARY DIAGNOSTIC ONLY — a reset only "counts" if there was an
        // in-progress above-threshold streak being cut short, not just
        // another silent frame while already silent.
        if (this.aboveThresholdSince !== null) this.vadResetOccurred = true;
        this.aboveThresholdSince = null;
      }
      if (this.speaking) {
        if (this.silenceStart === null) {
          this.silenceStart = now;
        } else if (now - this.silenceStart > this.opts.silenceDurationMs) {
          this.opts.onDebug('Silence held long enough — ending turn');
          // The loop genuinely stops here — nulling rafId FIRST (before
          // finishTurn, which can synchronously call back into
          // resumeListening via onSpeechEnd) is what lets resumeListening
          // see that it needs to restart it. Without that restart, this
          // return killed turn detection permanently: every turn after the
          // first completed one had no monitor running at all, which is
          // why the app reliably "heard me once, then died".
          this.rafId = null;
          this.finishTurn();
          return;
        }
      }
    }
    this.rafId = requestAnimationFrame(this.monitor);
  };

  /** Ends the current turn and hands the recorded clip back — WITHOUT
   *  stopping the recorder/AudioContext/mic. The old design had to stop()
   *  the MediaRecorder here and tear down and rebuild the entire pipeline
   *  for the next turn; here the recorder is simply paused (still holding
   *  the device) and the next turn reuses it directly via
   *  resumeListening(). No async teardown, so there's no window for the
   *  next turn to race against this one still finishing its cleanup. */
  private finishTurn(): void {
    resetTurnTiming();
    mark('mic_turn_end');
    const durationMs = this.speechStartedAt !== null ? performance.now() - this.speechStartedAt : 0;
    // Prepend the captured header chunk (see the field comment) so this
    // turn's Blob is a complete, independently-valid file — every prior
    // turn was missing this, regardless of platform or MIME type.
    const chunks = this.headerChunk ? [this.headerChunk, ...this.chunks] : this.chunks;
    this.opts.onDebug(`Turn finished: ${durationMs.toFixed(0)}ms of speech, ${chunks.length} chunk(s) recorded${this.headerChunk ? ' (incl. header)' : ' (NO HEADER CAPTURED)'}`);
    this.pauseListening();
    const blob = new Blob(chunks, { type: this.recordedMimeType });
    mark('capture_finalized');
    this.opts.onDebug(`Recorded blob: ${blob.size} bytes`);
    this.opts.onSpeechEnd(blob, durationMs);
  }

  /** Fully releases the mic/AudioContext/recorder. Call once, when voice
   *  is disabled or the component unmounts — or when reinitializing after
   *  a confirmed-unhealthy stream (see the hook's watchdog). */
  async teardown(): Promise<void> {
    this.opts.onDebug('[session] teardown() beginning');
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.active = false;
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      // Already stopped/inactive — nothing to do.
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.sourceNode?.disconnect();
    this.analyser?.disconnect();
    // AudioContext.close() is genuinely async — awaiting it (instead of
    // firing and forgetting) means a fresh AudioContext for a reinit never
    // gets created before this one has actually finished releasing its
    // resources, which is a real risk on constrained mobile hardware.
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
    this.opts.onDebug('[session] teardown() completed');
  }
}

// ---------- The hook that ties it all together ----------

// 'mic-lost': the mic track has permanently ended (most commonly iOS
// backgrounding the tab) and needs a real tap to recover — Safari refuses
// to grant a fresh mic stream from anything but a direct user gesture, so
// this state exists specifically to surface a tappable UI affordance
// rather than attempt (and silently fail) a programmatic reinit.
type ConversationState = 'idle' | 'speaking' | 'listening' | 'transcribing' | 'mic-lost';

// Minimal local typing for the Screen Wake Lock API: not universally
// present in TS's built-in DOM lib depending on target/lib config, and
// this app only ever touches the two members it actually uses. Avoids a
// hard build dependency on lib.dom's coverage of a still-evolving API.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
}

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
  // exchange number, so a failure can be directly correlated against a
  // reported "works for N exchanges, then stops" pattern.
  const turnCountRef = useRef(0);
  const sessionRef = useRef<VoiceSession | null>(null);
  const noSpeechTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every enable/disable/reinit. A pending init() that resolves
  // after it's been superseded checks this to know it's now orphaned (see
  // attemptInit()) instead of silently adopting itself as the live session.
  const initGenerationRef = useRef(0);
  // True from the moment the mic is confirmed lost (onStreamLost fired, or
  // the watchdog found it unhealthy) until resumeAfterMicLoss() runs.
  // Blocks startListening() from silently resuming against a session that
  // no longer has a working mic — without this, a speakResponse() already
  // in flight when the mic died would finish and call startListening()
  // anyway, overwriting the 'mic-lost' state with 'listening' against a
  // dead stream.
  const micLostRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

  // Screen Wake Lock: prevents the OS's automatic idle-timeout screen lock
  // while voice is active — the single most common real-world cause of the
  // mic being silently revoked (the person is listening/thinking, not
  // touching the screen, and it locks itself). This does NOT and cannot
  // prevent the person manually locking the phone or switching apps; no
  // website can override that on iOS. Feature-detected and best-effort:
  // unsupported browsers, and a request that's denied or later revoked by
  // the OS, both degrade to "no wake lock" rather than breaking anything.
  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) {
      logDebug('Wake Lock API not supported on this browser — screen may auto-lock during voice');
      return;
    }
    try {
      const sentinel = (await (navigator as unknown as { wakeLock: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock.request('screen'));
      wakeLockRef.current = sentinel;
      logDebug('Screen wake lock acquired');
      sentinel.addEventListener('release', () => {
        logDebug('Screen wake lock was released (system-level, e.g. low battery or tab hidden)');
        wakeLockRef.current = null;
      });
    } catch (err) {
      logDebug(`Wake lock request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const releaseWakeLock = async () => {
    try {
      await wakeLockRef.current?.release();
    } catch {
      // Already released — nothing to do.
    }
    wakeLockRef.current = null;
  };

  // The Wake Lock spec has the sentinel auto-release whenever the document
  // becomes hidden — it does not silently reacquire itself when the tab
  // becomes visible again. Without this, a brief backgrounding that the
  // mic itself survived (e.g. a quick notification glance, not long enough
  // for iOS to revoke the mic) would still permanently lose wake-lock
  // protection for the rest of the conversation.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabledRef.current && wakeLockRef.current === null) {
        void requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The persistent VoiceSession's callbacks are wired up ONCE, when the
  // session is created — unlike the old per-turn design, they are not
  // rebuilt every turn. Routing onUserSpeech through a ref (kept current
  // via this effect) means every turn calls whatever `onUserSpeech` the
  // caller most recently passed in, instead of freezing on whichever
  // version existed at the moment voice was enabled.
  const onUserSpeechRef = useRef(onUserSpeech);
  useEffect(() => {
    onUserSpeechRef.current = onUserSpeech;
  }, [onUserSpeech]);

  const MIN_CLIP_MS = 400;
  // A normal long pause (the person is thinking, stepped away briefly)
  // must never be mistaken for a dead mic — required to tolerate at least
  // 40s of silence before the user starts speaking. Set well above that
  // with real margin, not just barely over it.
  const NO_SPEECH_TIMEOUT_MS = 50000;
  const MIC_INIT_TIMEOUT_MS = 10000;

  const clearWatchdog = () => {
    if (noSpeechTimerRef.current !== null) {
      clearTimeout(noSpeechTimerRef.current);
      noSpeechTimerRef.current = null;
    }
  };

  /** Runs session.init(), bounded by a timeout, WITHOUT ever leaving an
   *  orphaned mic stream / AudioContext running if the timeout wins.
   *  Promise.race famously does not cancel its loser — the previous
   *  per-turn design raced mic acquisition against a timeout on every
   *  single turn and never followed up on a late winner, which is a real,
   *  provable leak vector (the diagnostic evidence gathered so far just
   *  hadn't caught it in the act). Fixed here by always attaching a
   *  completion handler to the real init() promise, generation-gated: if
   *  it finishes after something else has already superseded it, it tears
   *  itself down instead of being left running with nothing left to ever
   *  stop it. Because there is now only ONE init() per conversation
   *  (instead of one per turn), this exact race is also far less likely to
   *  matter in practice — but it's now closed structurally, not just
   *  shrunk. */
  type InitResult = { status: 'ok' } | { status: 'timeout' } | { status: 'failed'; error: unknown };

  const attemptInit = (session: VoiceSession, myGeneration: number): Promise<InitResult> => {
    const initPromise = session.init();
    initPromise.then(
      () => {
        if (myGeneration !== initGenerationRef.current) {
          logDebug('Late mic init completed after being superseded — tearing down orphaned session');
          void session.teardown();
        }
      },
      () => {
        // Failure already surfaced via the race result below; nothing
        // else to clean up since a failed init() never leaves resources open.
      }
    );
    // TEMPORARY DIAGNOSTIC: carry the actual rejection (e.g. a
    // getUserMedia DOMException like NotAllowedError/NotFoundError/
    // NotReadableError) through to the caller instead of discarding it —
    // "Mic init failed" alone doesn't say WHY, the same gap that hid the
    // real Groq error earlier.
    const settled = initPromise.then(
      (): InitResult => ({ status: 'ok' }),
      (error: unknown): InitResult => ({ status: 'failed', error })
    );
    const timedOut = new Promise<InitResult>((resolve) => setTimeout(() => resolve({ status: 'timeout' }), MIC_INIT_TIMEOUT_MS));
    return Promise.race([settled, timedOut]);
  };

  const handleSpeechEnd = (blob: Blob, durationMs: number) => {
    clearWatchdog();
    // A clip shorter than this is almost certainly a noise blip, not a
    // word — sending it to Whisper risks a hallucinated transcription (a
    // known failure mode on near-silent audio), which would then get
    // treated as a real reply and loop the conversation on nothing said.
    if (durationMs < MIN_CLIP_MS) {
      logDebug(`Clip too short (${durationMs.toFixed(0)}ms) — listening again`);
      startListening();
      return;
    }

    setState('transcribing');
    logDebug('Sending audio to /api/transcribe…');

    void (async () => {
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
        const transcript = text?.trim() ?? '';
        if (isWhisperSilenceArtifact(transcript)) {
          // See WHISPER_SILENCE_ARTIFACTS — this is a transcription of
          // silence, not something the person said, so it must not become
          // a chat message. Just keep listening.
          logDebug(`Ignoring "${transcript}" — known transcription-of-silence artifact, not a real message`);
          startListening();
          return;
        }
        onUserSpeechRef.current(transcript);
      } catch (err) {
        const isTimeout = err instanceof Error && err.name === 'AbortError';
        logDebug(isTimeout ? 'Transcription timed out after 15s — listening again' : `Transcription error: ${err instanceof Error ? err.message : String(err)}`);
        if (!isTimeout) console.error('Transcription failed:', err);
        startListening();
      } finally {
        clearTimeout(timeoutId);
      }
    })();
  };

  const makeSessionOptions = (): VoiceSessionOptions => ({
    onDebug: logDebug,
    onSpeechStart: () => {
      // Real speech is happening — let the normal turn-ending logic
      // (silence after speech) take over instead of the no-speech watchdog.
      clearWatchdog();
    },
    onSpeechEnd: handleSpeechEnd,
    onStreamLost: () => {
      if (!enabledRef.current) return;
      logDebug('Mic stream ended — needs a tap to resume (Safari only re-grants mic access from a real user gesture)');
      clearWatchdog();
      micLostRef.current = true;
      setState('mic-lost');
    },
  });

  /** Fires once per listening period; if nothing is heard for
   *  NO_SPEECH_TIMEOUT_MS, checks whether the mic is still genuinely
   *  healthy. Healthy → this is just a long thinking pause, keep waiting
   *  (reschedules itself). Unhealthy → surfaces the same tap-to-resume
   *  prompt as onStreamLost, rather than attempting a silent reinit.
   *
   *  This is a secondary safety net, not the primary detector —
   *  onStreamLost (wired to the mic track's real 'ended' event) already
   *  catches the one real failure mode observed (iOS backgrounding) within
   *  seconds. This only matters if that event somehow doesn't fire. A
   *  silent getUserMedia() reinit from here was tried and directly
   *  confirmed to fail with NotAllowedError — Safari requires a real user
   *  gesture, which a timer callback can never provide — so there's no
   *  reason to attempt it again from this path either. */
  const startWatchdog = () => {
    clearWatchdog();
    noSpeechTimerRef.current = setTimeout(() => {
      const session = sessionRef.current;
      if (!session || !enabledRef.current) return;
      if (session.isHealthy()) {
        logDebug(`No speech in ${NO_SPEECH_TIMEOUT_MS / 1000}s — mic still healthy, continuing to listen`);
        startWatchdog();
        return;
      }
      logDebug('Mic appears unhealthy (track ended/muted) — needs a tap to resume');
      micLostRef.current = true;
      setState('mic-lost');
    }, NO_SPEECH_TIMEOUT_MS);
  };

  const startListening = useCallback(() => {
    if (!enabledRef.current || micLostRef.current) return;
    const session = sessionRef.current;
    if (!session) {
      logDebug('startListening called with no active session — ignoring');
      return;
    }
    setState('listening');
    turnCountRef.current += 1;
    logDebug(`Listening for your voice… (turn #${turnCountRef.current})`);
    session.resumeListening();
    startWatchdog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Call from a real tap on the "tap to resume" prompt after mic-lost.
   *  This is the ONLY place a fresh getUserMedia() is requested outside of
   *  enableVoiceConversation() — deliberately, since it must run
   *  synchronously off a real click/tap to satisfy Safari's user-gesture
   *  requirement for re-granting mic access once it's been lost. */
  const resumeAfterMicLoss = useCallback(async () => {
    logDebug('Resuming after mic loss…');
    micLostRef.current = false;
    clearWatchdog();
    const myGeneration = ++initGenerationRef.current;
    const oldSession = sessionRef.current;
    sessionRef.current = null;
    void oldSession?.teardown();
    const session = new VoiceSession(makeSessionOptions());
    const result = await attemptInit(session, myGeneration);
    if (myGeneration !== initGenerationRef.current) return; // superseded (e.g. disabled meanwhile)
    if (result.status !== 'ok') {
      const detail = result.status === 'timeout' ? 'timed out after 10s' : (result.error instanceof Error ? `${result.error.name}: ${result.error.message}` : String(result.error));
      logDebug(`Resume failed: ${detail}`);
      micLostRef.current = true;
      setState('mic-lost');
      return;
    }
    sessionRef.current = session;
    void requestWakeLock();
    startListening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  /** Call once, from a real tap. Unlocks audio, then stands up the ONE
   *  persistent mic/AudioContext/recorder pipeline for the whole
   *  conversation — everything after this is lightweight state
   *  transitions within that same session, not new mic sessions. */
  const enableVoiceConversation = useCallback(async () => {
    logDebug('Enabling voice: unlocking audio…');
    unlockAudio();
    micLostRef.current = false;
    const myGeneration = ++initGenerationRef.current;
    const session = new VoiceSession(makeSessionOptions());
    const result = await attemptInit(session, myGeneration);
    if (myGeneration !== initGenerationRef.current) return; // superseded while initializing
    if (result.status !== 'ok') {
      if (result.status === 'timeout') {
        logDebug('Mic init timed out after 10s');
      } else {
        const err = result.error;
        const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        logDebug(`Mic init failed: ${detail}`);
      }
      return;
    }
    sessionRef.current = session;
    enabledRef.current = true;
    setEnabled(true);
    logDebug('Voice enabled — persistent mic session started');
    void requestWakeLock();
    startListening();
  }, [startListening]);

  const disableVoiceConversation = useCallback(() => {
    ++initGenerationRef.current; // invalidate any in-flight init()
    clearWatchdog();
    enabledRef.current = false;
    micLostRef.current = false;
    setEnabled(false);
    setState('idle');
    const session = sessionRef.current;
    sessionRef.current = null;
    void session?.teardown();
    void releaseWakeLock();
  }, []);

  /** Call whenever MindTip has a new response. Auto-starts listening when done speaking. */
  const speakResponse = useCallback(
    async (text: string, voiceKey?: string) => {
      if (!enabledRef.current) {
        logDebug('speakResponse called but voice is not enabled — skipped');
        return;
      }
      clearWatchdog();
      setState('speaking');
      sessionRef.current?.pauseListening();
      try {
        await speakText(text, voiceKey, logDebug);
      } catch (err) {
        logDebug(`Error: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Speech playback failed:', err);
      }
      finishTurnAndReport(logDebug);
      // A captured log once showed listening beginning the exact instant
      // playback ended — zero gap between the speaker finishing and the
      // mic being asked to react. Audio hardware switching from output to
      // input isn't always instantaneous; this small pause gives that
      // transition room to complete before we resume reacting to input.
      if (enabledRef.current) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      startListening();
    },
    [startListening]
  );

  // Safety net: this hook has no other tie to the component's lifecycle, so
  // without this, exiting a conversation (or any other unmount) leaves the
  // mic stream, AudioContext, and requestAnimationFrame monitor loop
  // running in the browser indefinitely -- raw browser APIs like these
  // don't stop just because the React component that created them went
  // away. handleExit calling disableVoiceConversation() explicitly is the
  // primary fix; this covers every other way the component could unmount.
  useEffect(() => {
    return () => {
      ++initGenerationRef.current;
      enabledRef.current = false;
      micLostRef.current = false;
      clearWatchdog();
      const session = sessionRef.current;
      sessionRef.current = null;
      void session?.teardown();
      void releaseWakeLock();
      if (debugFlushTimerRef.current !== null) {
        clearTimeout(debugFlushTimerRef.current);
        debugFlushTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, enabled, debugLog, logDebug, enableVoiceConversation, disableVoiceConversation, speakResponse, startListening, resumeAfterMicLoss };
}
