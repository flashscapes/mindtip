import { useState } from 'react'

interface MoodCheckInProps {
  // Fires once the user confirms their mood. `message` is the natural-language
  // sentence handed to the AI as the opening line of the conversation.
  onSubmit: (message: string) => void
}

// 1 (awful) through 7 (pretty good). Each label doubles as both the on-screen
// text and the basis for the message sent to start the conversation.
const MOOD_LABELS = [
  'Awful',
  'Very frustrated',
  'Not great',
  'A lot on my mind',
  'Just okay',
  'Working on things',
  'Pretty good'
] as const

const MOOD_MESSAGES = [
  "I'm feeling awful right now.",
  "I'm feeling very frustrated and overwhelmed.",
  "I'm not feeling great right now.",
  "I've got a lot on my mind right now.",
  "I'm feeling just okay.",
  "I'm working on things and feeling steady.",
  "I'm feeling pretty good."
] as const

const MIN = 1
const MAX = 7

export function MoodCheckIn({ onSubmit }: MoodCheckInProps) {
  const [value, setValue] = useState(4) // starts at the middle: "A lot on my mind"
  const index = value - 1
  const label = MOOD_LABELS[index]

  // 0 (worst) to 1 (best) — drives both the face expression and its color.
  const t = (value - MIN) / (MAX - MIN)

  // Mouth curves from a deep frown (t=0) through flat (t=0.5) to a broad
  // smile (t=1). Control-point Y drives the curvature direction/amount.
  const mouthControlY = 68 + (1 - t) * 22 - t * 14
  const mouthPath = `M 74 74 Q 100 ${mouthControlY} 126 74`

  // Face color shifts from a cooler, muted aqua at low mood to a warmer,
  // brighter aqua-gold blend at high mood — stays in the app's palette
  // instead of jumping to literal red/green.
  const faceFrom = t < 0.5 ? '#8FB6BE' : '#7FCFC0'
  const faceTo = t < 0.5 ? '#5C8A93' : '#4FAE9E'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-44 h-44" role="img" aria-label={`Mood: ${label}`}>
        <defs>
          <radialGradient id="moodFace" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor={faceFrom} />
            <stop offset="100%" stopColor={faceTo} />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="72" fill="url(#moodFace)" />
        {/* Closed, curved eyes in every state — calm rather than cartoonish */}
        <path d="M 68 88 Q 78 80 88 88" stroke="#25383A" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
        <path d="M 112 88 Q 122 80 132 88" stroke="#25383A" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
        <path d={mouthPath} stroke="#25383A" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
      </svg>

      <p className="font-display font-light text-[22px] text-ivory mt-6 mb-1">{label}</p>
      <p className="font-sans text-[13px] text-mist mb-8">How are you feeling right now?</p>

      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={value}
        onChange={e => setValue(Number(e.target.value))}
        aria-label="Mood slider, 1 awful to 7 pretty good"
        className="w-full accent-bronze mb-10"
      />

      <button
        onClick={() => onSubmit(MOOD_MESSAGES[index])}
        className="w-full bg-panel rounded-card px-6 py-4 flex items-center justify-between text-left shadow-sm"
      >
        <span className="font-sans text-[15px] text-ivory">
          I'm feeling <span className="text-bronze">{label.toLowerCase()}</span>.
        </span>
        <span className="text-bronze text-[18px] ml-4">→</span>
      </button>
    </div>
  )
}
