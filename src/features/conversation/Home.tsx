import { useState } from 'react'
import type { UserProfile } from '@/types'
import { unlockAudio } from '@/voice'

interface HomeProps {
  profile: UserProfile
  // `autoVoice` tells the caller to enable full hands-free voice for this
  // conversation before the first response ever arrives.
  onStart: (message: string, autoVoice?: boolean) => void
}

// Each intention becomes the opening line of the conversation, written as
// something the person would actually say — not a canned line from MindTip.
// The AI generates its own genuine first reply from this, informed by a
// small, generic instruction in the system prompt: the intention is a
// starting lens, not a script or a separate mode.
const INTENTIONS = [
  {
    key: 'calm',
    label: 'Calm',
    seed: "I want to find a little calm today.",
    colors: ['#8FE0D0', '#4FAE9E']
  },
  {
    key: 'focus',
    label: 'Focus',
    seed: "I'm having trouble focusing and want some clarity.",
    colors: ['#9AC4CC', '#3D7A85']
  },
  {
    key: 'balance',
    label: 'Balance',
    seed: "I've been feeling pulled in a lot of directions and want some balance.",
    colors: ['#E3CFA0', '#B8935A']
  },
  {
    key: 'energy',
    label: 'Energy',
    seed: "I want to explore what's giving me energy, or taking it, right now.",
    colors: ['#E3EDA0', '#9BCB74']
  }
] as const

const DEFAULT_ORB_COLORS: readonly [string, string] = ['#9AD9CC', '#4FAE9E']

export function Home({ profile, onStart }: HomeProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const name = profile.preferredName ? `, ${profile.preferredName}` : ''

  const activeIntention = INTENTIONS.find(i => i.key === selected)
  const [orbFrom, orbTo] = activeIntention?.colors ?? DEFAULT_ORB_COLORS

  const handleExplore = () => {
    if (!activeIntention) return
    // Must be called synchronously inside this real tap to satisfy the
    // browser's autoplay policy — see the same pattern previously used for
    // the mood check-in submit.
    unlockAudio()
    onStart(activeIntention.seed, true)
  }

  return (
    <div className="relative min-h-dvh flex flex-col px-8 py-14 overflow-hidden bg-gradient-to-br from-[#E9F5F3] via-[#DCEFEC] to-[#CFEAE5]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#7FCFC0] opacity-30 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-[#B8935A] opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#4FAE9E] opacity-25 blur-3xl" />
      </div>

      <p className="relative z-10 font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</p>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        <h1 className="font-display font-light text-[26px] leading-snug text-ivory text-center mb-10">
          What shall we explore today{name}?
        </h1>

        <div
          className="mindtip-orb w-32 h-32 rounded-full mb-10 transition-all duration-700"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${orbFrom}, ${orbTo})`,
            boxShadow: '0 20px 50px -15px rgba(37,56,58,0.35)'
          }}
        />

        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          {INTENTIONS.map(intention => (
            <button
              key={intention.key}
              onClick={() => setSelected(intention.key)}
              className={`rounded-2xl py-6 text-center border transition-all duration-300 ${
                selected === intention.key
                  ? 'bg-white/60 border-bronze shadow-md'
                  : 'bg-white/35 border-white/50 hover:bg-white/45'
              }`}
            >
              <span className="font-sans text-[15px] text-ivory">{intention.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleExplore}
          disabled={!activeIntention}
          className="w-full bg-gradient-to-r from-[#B8935A] to-[#A5804B] text-white font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(184,147,90,0.6)] disabled:opacity-40 disabled:shadow-none transition-all duration-300 mb-8"
        >
          Explore
        </button>

        <form
          onSubmit={e => {
            e.preventDefault()
            if (text.trim()) onStart(text.trim())
          }}
          className="w-full"
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Or tell me what's on your mind…"
            className="w-full bg-transparent text-[15px] text-ivory placeholder:text-mist/70 outline-none pb-3 text-center focus:border-bronze transition-colors duration-300"
            style={{ borderBottom: '1px solid rgba(37,56,58,0.14)' }}
          />
        </form>
      </div>
    </div>
  )
}
