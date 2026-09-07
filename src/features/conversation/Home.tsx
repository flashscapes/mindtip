import { useState } from 'react'
import type { UserProfile } from '@/types'

interface HomeProps {
  profile: UserProfile
  onStart: (message: string) => void
}

const PRIMARY_CHOICES = ['Frustrated', 'Stressed', 'Overthinking']

export function Home({ profile, onStart }: HomeProps) {
  const [text, setText] = useState('')
  const name = profile.preferredName ? `, ${profile.preferredName}` : ''

  return (
    <div className="min-h-dvh bg-canvas flex flex-col px-8 py-16 max-w-sm mx-auto">
      <p className="font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</p>

      <div className="flex-1 flex flex-col justify-center -mt-8">
        <h1 className="font-display font-light text-[32px] leading-snug text-ivory mb-16">
          Hey{name}, what's<br />going on?
        </h1>

        <div>
          {PRIMARY_CHOICES.map((choice, i) => (
            <button
              key={choice}
              onClick={() => onStart(`I'm feeling ${choice.toLowerCase()}.`)}
              style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(244,241,234,0.08)' }}
              className="group w-full text-left py-4 flex items-center"
            >
              <span className="font-sans text-[19px] font-normal text-ivory group-hover:text-bronze group-hover:translate-x-1 transition-all duration-300">
                {choice}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={() => onStart("I'm just checking in.")}
          className="group mt-10 pt-6 text-left"
          style={{ borderTop: '1px solid rgba(244,241,234,0.08)' }}
        >
          <span className="font-sans text-[15px] text-mist group-hover:text-bronze transition-colors duration-300">
            Just checking in
          </span>
        </button>
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
          style={{ borderBottom: '1px solid rgba(244,241,234,0.14)' }}
        />
      </form>
    </div>
  )
}
