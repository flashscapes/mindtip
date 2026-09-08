// DESTINATION: src/components/SpeakerButton.tsx
//
// Usage: drop this next to any AI response text your app already generates
// (e.g. the Gemini reflection your AIProvider returns) — it does NOT
// generate its own text, it just narrates whatever `text` you pass in.
//
//   <SpeakerButton text={aiResponse} />

import { useState } from 'react';
import { unlockAudio, speakText, stopSpeaking } from '../../lib/tts';

interface SpeakerButtonProps {
  text: string;
  voice?: string; // defaults to 'en-US-AvaNeural' server-side
  className?: string;
}

export default function SpeakerButton({ text, voice, className }: SpeakerButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle');

  async function handleTap() {
    if (status === 'playing' || status === 'loading') {
      stopSpeaking();
      setStatus('idle');
      return;
    }

    // Must happen synchronously, inside this handler, before any await —
    // this is what keeps iOS Safari from blocking playback later.
    unlockAudio();

    setStatus('loading');
    try {
      await speakText(text, voice);
      setStatus('playing');
    } catch (err) {
      console.error('Speech playback failed:', err);
      setStatus('error');
      return;
    }
  }

  const label =
    status === 'loading' ? 'Loading…' : status === 'playing' ? 'Stop' : status === 'error' ? 'Retry' : 'Listen';

  return (
    <button
      onClick={handleTap}
      disabled={!text}
      className={
        className ??
        'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ' +
          'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 ' +
          'transition-colors'
      }
      aria-label={label}
    >
      <span aria-hidden>{status === 'playing' ? '⏸' : '🔊'}</span>
      {label}
    </button>
  );
}
