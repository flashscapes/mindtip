// DESTINATION: src/lib/tts.ts

// A single, reused <audio> element. iOS Safari only allows audio.play() to
// succeed when it's called synchronously inside a user gesture (a tap
// handler) — not after an `await fetch(...)`, which is "too far" from the
// tap. Reusing one pre-unlocked element, rather than creating a fresh
// Audio() after the fetch resolves, is what keeps playback working there.
let sharedAudioEl: HTMLAudioElement | null = null;

function getSharedAudio(): HTMLAudioElement {
  if (!sharedAudioEl) {
    sharedAudioEl = new Audio();
    sharedAudioEl.playsInline = true;
  }
  return sharedAudioEl;
}

/**
 * Call this SYNCHRONOUSLY inside the tap/click handler, before any await.
 * It plays a silent placeholder to "unlock" the shared element for this
 * gesture, so a later programmatic .play() (after your async fetch) is
 * allowed to actually produce sound on iOS Safari.
 */
export function unlockAudio(): void {
  const audio = getSharedAudio();
  audio.muted = true;
  audio.src = 'data:audio/mp3;base64,//uQx';
  audio.play().catch(() => {
    // Expected to sometimes reject immediately (empty/short source) — fine.
  });
  audio.pause();
  audio.muted = false;
}

async function fetchSpeechBlobUrl(text: string, voice?: string): Promise<string> {
  const res = await fetch('/api/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    throw new Error(`TTS fetch failed: ${res.status}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

function playBlobUrl(url: string): Promise<void> {
  const audio = getSharedAudio();
  audio.src = url;
  return audio.play();
}

/**
 * Full flow: fetch synthesized speech for `text` and play it on the shared
 * audio element. Call `unlockAudio()` synchronously in the same tap handler
 * BEFORE calling this — see SpeakerButton.tsx for the pattern.
 */
export async function speakText(text: string, voice?: string): Promise<void> {
  const url = await fetchSpeechBlobUrl(text, voice);
  await playBlobUrl(url);
}

/** Stop whatever is currently playing (e.g. user navigates away or taps again). */
export function stopSpeaking(): void {
  const audio = getSharedAudio();
  audio.pause();
  audio.currentTime = 0;
}
