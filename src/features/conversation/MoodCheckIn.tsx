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

// One color per mood position — a deliberate progression from a cool, muted
// slate-aqua at the low end to a warm golden-green at the high end, staying
// inside the app's aqua/spa family rather than jumping to literal red/green.
const MOOD_COLORS = [
  '#8C97AC', // Awful — cool, muted slate-lavender
  '#82A2AE', // Very frustrated — cool slate-teal
  '#78AEAB', // Not great
  '#70BBA6', // A lot on my mind — core aqua, slightly muted
  '#6BC79E', // Just okay — balanced aqua-green
  '#7DCB86', // Working on things — warmth entering
  '#9BCB74'  // Pretty good — warm golden-green
] as const

const MIN = 1
const MAX = 7

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Darkens a hex color by a factor (0-1, where lower is darker) — used to build the face's gradient shade from its base tone. */
function darken(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex([r * factor, g * factor, b * factor])
}

export function MoodCheckIn({ onSubmit }: MoodCheckInProps) {
  const [value, setValue] = useState(4) // starts at the middle: "A lot on my mind"
  const index = value - 1
  const label = MOOD_LABELS[index]

  // 0 (worst) to 1 (best) — drives the eyebrow/mouth expression.
  const t = (value - MIN) / (MAX - MIN)
  const expression = t - 0.5 // -0.5 (very low) to +0.5 (very good), 0 = neutral

  // Mouth: corners are fixed at y=118; the curve's midpoint moves relative
  // to them. Pushing the midpoint below the corners (larger y) bends the
  // ends upward into a smile; pushing it above the corners (smaller y)
  // droops the ends into a frown. Amplitude scales with how far from
  // neutral the mood is, so "just okay" reads as a flat, level mouth.
  const mouthMidY = 118 + expression * 68
  const mouthPath = `M 74 118 Q 100 ${mouthMidY} 126 118`

  // Eyebrows sit above the eyes near the top of the face and use the same
  // directional logic at a much smaller amplitude: they arch up and knit
  // together for a worried look at low mood, and relax downward at high
  // mood — subtle, but reads as furrowed vs. relaxed at a glance.
  const browMidY = 83 - expression * 9
  const leftBrow = `M 67 84 Q 78 ${browMidY} 89 84`
  const rightBrow = `M 111 84 Q 122 ${browMidY} 133 84`

  // Eyes: open, with a visible iris/pupil and a small catchlight for real
  // gaze and life, rather than a simple closed-eye line. Eye height narrows
  // slightly at low mood (a gentle squint) and widens slightly at high mood
  // (bright, alert) — continuous with `expression`, so it never jumps
  // discretely between mood steps.
  const eyeRy = 8 + expression * 2
  const leftEyeCx = 78
  const rightEyeCx = 122
  const eyeCy = 98

  // Blush fades in only above neutral mood — invisible at "Just okay" and
  // below, gradually appearing through "Working on things" to "Pretty good".
  const blushOpacity = Math.max(0, expression) * 0.7

  const faceBase = MOOD_COLORS[index]
  const faceEdge = darken(faceBase, 0.68)
  const lineColor = darken(faceBase, 0.32)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48 h-48" role="img" aria-label={`Mood: ${label}`}>
        <defs>
          <radialGradient id="moodFace" cx="34%" cy="28%" r="78%">
            <stop offset="0%" stopColor={faceBase} />
            <stop offset="100%" stopColor={faceEdge} />
          </radialGradient>
          <radialGradient id="moodHighlight" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <filter id="moodShadow" x="-50%" y="-30%" width="200%" height="200%">
            <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor={faceEdge} floodOpacity="0.35" />
          </filter>
        </defs>

        <circle cx="100" cy="104" r="74" fill="url(#moodFace)" filter="url(#moodShadow)" />
        {/* Soft upper-left specular highlight for a glossy, dimensional feel */}
        <ellipse cx="76" cy="72" rx="34" ry="24" fill="url(#moodHighlight)" />

        <path d={leftBrow} stroke={lineColor} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.7" />
        <path d={rightBrow} stroke={lineColor} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.7" />

        {/* Blush — invisible below neutral mood, fades in as mood improves */}
        <ellipse cx={leftEyeCx - 16} cy={eyeCy + 14} rx="9" ry="6" fill="#E8886B" opacity={blushOpacity * 0.5} />
        <ellipse cx={rightEyeCx + 16} cy={eyeCy + 14} rx="9" ry="6" fill="#E8886B" opacity={blushOpacity * 0.5} />

        {/* Open eyes: sclera, iris, pupil, and a small catchlight for real gaze */}
        <ellipse cx={leftEyeCx} cy={eyeCy} rx="9" ry={eyeRy} fill="#FBFAF3" />
        <circle cx={leftEyeCx} cy={eyeCy} r="5" fill={lineColor} />
        <circle cx={leftEyeCx + 2} cy={eyeCy - 2.5} r="1.6" fill="#FBFAF3" />
        <ellipse cx={rightEyeCx} cy={eyeCy} rx="9" ry={eyeRy} fill="#FBFAF3" />
        <circle cx={rightEyeCx} cy={eyeCy} r="5" fill={lineColor} />
        <circle cx={rightEyeCx + 2} cy={eyeCy - 2.5} r="1.6" fill="#FBFAF3" />

        {/* Subtle nose — a soft shadow, not a hard line */}
        <path d="M 97 108 Q 100 112 103 108" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.35" />

        <path d={mouthPath} stroke={lineColor} strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.7" />
      </svg>

      <p className="font-display font-light text-[22px] text-ivory mt-4 mb-1">{label}</p>
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
