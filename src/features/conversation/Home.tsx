import { useState } from 'react'
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
  const storedMemories = new LocalMemoryService().getAll()

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

      {/* TEMPORARY — remove once memory extraction is confirmed working. */}
      <div className="mt-6 pt-4 text-[10px] text-mist/70" style={{ borderTop: '1px solid rgba(37,56,58,0.1)' }}>
        🔧 {storedMemories.length} memor{storedMemories.length === 1 ? 'y' : 'ies'} stored:
        {storedMemories.map(m => (
          <div key={m.id}>• [{m.type}, {m.confidence}] {m.content}</div>
        ))}
      </div>
    </div>
  )
}
