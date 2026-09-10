import { useEffect, useState } from 'react'
import type { UserProfile } from '@/types'
import { unlockAudio } from '@/voice'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { MoodCheckIn } from './MoodCheckIn'

interface HomeProps {
  profile: UserProfile
  // `autoVoice` tells the caller to enable full hands-free voice for this
  // conversation before the first response ever arrives.
  onStart: (message: string, autoVoice?: boolean) => void
}

export function Home({ profile, onStart }: HomeProps) {
  const [text, setText] = useState('')
  const name = profile.preferredName ? `, ${profile.preferredName}` : ''

  // Memory extraction runs in the background after Close and takes a real
  // API round-trip (a few seconds) to finish. Home was previously reading
  // localStorage exactly once, at the instant it first rendered — meaning
  // it always missed the result, which lands afterward. This polls for a
  // short window so the debug panel actually catches it when it arrives.
  const [storedMemories, setStoredMemories] = useState(() => new LocalMemoryService().getAll())
  const [extractionDebug, setExtractionDebug] = useState(() => localStorage.getItem('mindtip_extraction_debug'))

  useEffect(() => {
    const refresh = () => {
      setStoredMemories(new LocalMemoryService().getAll())
      setExtractionDebug(localStorage.getItem('mindtip_extraction_debug'))
    }
    const interval = setInterval(refresh, 1000)
    const timeout = setTimeout(() => clearInterval(interval), 15000) // stop polling after 15s
    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [])

  const handleMoodSubmit = (message: string) => {
    // Must be called synchronously inside this real tap to satisfy the
    // browser's autoplay policy — it unlocks audio playback for the whole
    // session, so the spoken response that follows in Conversation can
    // play without needing a second gesture.
    unlockAudio()
    onStart(message, true)
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col px-8 py-16 max-w-sm mx-auto">
      <p className="font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</p>

      {/* TEMPORARY — remove once memory extraction is confirmed working. Placed
          at the very top so it's visible with zero scrolling. */}
      <div className="mt-2 mb-4 text-[11px] text-bronze bg-panel/80 rounded-lg px-3 py-2">
        🔧 {storedMemories.length} memor{storedMemories.length === 1 ? 'y' : 'ies'} stored
        {storedMemories.map(m => (
          <div key={m.id}>• [{m.type}] {m.content}</div>
        ))}
        {extractionDebug && <div className="mt-1 text-mist">Last extraction: {extractionDebug}</div>}
      </div>

      <div className="flex-1 flex flex-col justify-center -mt-8">
        <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10 text-center">
          How are you today{name}?
        </h1>

        <MoodCheckIn onSubmit={handleMoodSubmit} />
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          if (text.trim()) onStart(text.trim())
        }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Or tell me what's on your mind…"
          className="w-full bg-transparent text-[15px] text-ivory placeholder:text-mist/70 outline-none pb-3 focus:border-bronze transition-colors duration-300"
          style={{ borderBottom: '1px solid rgba(37,56,58,0.14)' }}
        />
      </form>
    </div>
  )
}
