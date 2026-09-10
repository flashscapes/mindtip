import { useState } from 'react'
import type { SupportStyle, UserProfile } from '@/types'
import { HELPS_OPTIONS, TRIGGER_OPTIONS, UNHELPFUL_OPTIONS } from '@/lib/constants'
import { TextToggle } from '@/components/ui/TextToggle'
import { Button } from '@/components/ui/Button'

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void
}

// Six fixed positions arranged around a center orb. Deliberately hand-placed
// (not dynamically laid out) — this is what makes the connecting lines
// simple and 100% reliable: every star's coordinates are known in advance,
// so drawing a line from a selected star to the orb is just a plain SVG
// <line> between two fixed points, never a measured/computed position.
// Matched 1:1 with exactly 6 options per category (TRIGGER_OPTIONS and
// HELPS_OPTIONS are both curated down to 6 for this reason) — if either
// list's length ever changes, this array must be updated to match.
const STAR_POSITIONS = [
  { x: 150, y: 40, labelDy: -14 },  // top
  { x: 225, y: 75, labelDy: -14 },  // upper-right
  { x: 225, y: 205, labelDy: 20 },  // lower-right
  { x: 150, y: 240, labelDy: 20 },  // bottom
  { x: 75, y: 205, labelDy: 20 },   // lower-left
  { x: 75, y: 75, labelDy: -14 }    // upper-left
] as const
const ORB_X = 150
const ORB_Y = 140

// A single constellation field: a center orb plus up to 6 tappable stars,
// with a real line drawn from each selected star to the orb. Each star's
// actual tap target is a transparent circle at r=22 (44px-equivalent
// diameter, matching Apple's guidance for reliable touch targets) — much
// larger than its small visible dot, wrapped together with the label in
// one clickable <g> so tapping anywhere near the star (not just the tiny
// dot itself) registers reliably on iPhone.
function ConstellationField({
  options,
  selected,
  onToggle,
  color,
  orbColor
}: {
  options: readonly string[]
  selected: string[]
  onToggle: (value: string) => void
  color: string
  orbColor: string
}) {
  return (
    <svg
      viewBox="0 0 300 280"
      className="w-full rounded-2xl"
      style={{ background: `radial-gradient(circle at 50% 45%, ${orbColor}22, #0E2124)` }}
    >
      {options.map((opt, i) => {
        const p = STAR_POSITIONS[i]
        if (!p || !selected.includes(opt)) return null
        return <line key={`line-${opt}`} x1={p.x} y1={p.y} x2={ORB_X} y2={ORB_Y} stroke={color} strokeWidth="1.5" opacity="0.7" />
      })}

      <circle cx={ORB_X} cy={ORB_Y} r="13" fill={orbColor} />
      <circle cx={ORB_X} cy={ORB_Y} r="13" fill="none" stroke={color} strokeWidth="2" opacity="0.5" />

      {options.map((opt, i) => {
        const p = STAR_POSITIONS[i]
        if (!p) return null
        const isSelected = selected.includes(opt)
        return (
          <g key={opt} onClick={() => onToggle(opt)} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={isSelected ? 7 : 4} fill={color} opacity={isSelected ? 1 : 0.5} />
            <text
              x={p.x}
              y={p.y + p.labelDy}
              fill={color}
              fontSize={isSelected ? 12 : 11}
              textAnchor="middle"
              opacity={isSelected ? 1 : 0.7}
            >
              {opt}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const SUPPORT_STYLES: { value: SupportStyle; label: string; description: string }[] = [
  { value: 'validate_first', label: 'Validate me first', description: 'Let me feel heard before we talk about what to do.' },
  { value: 'action_first', label: 'Give me the plan', description: 'Skip ahead — tell me what to actually do.' },
  { value: 'blend', label: 'A little of both', description: 'Quick acknowledgment, then straight to action.' }
]

// Five steps: name, triggers (constellation), support style (unchanged),
// helps (constellation), what doesn't help (unchanged). Proactive
// check-ins was removed entirely — confirmed via a full codebase search
// that nothing outside this file ever read that field, so it wasn't yet a
// meaningful feature; the profile field itself still exists on the type
// and is just always set to false now, keeping this change isolated to
// this one file.
const TOTAL_STEPS = 5
type Step = 0 | 1 | 2 | 3 | 4

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(0)
  const [preferredName, setPreferredName] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [supportStyle, setSupportStyle] = useState<SupportStyle>('blend')
  const [helps, setHelps] = useState<string[]>([])
  const [unhelpful, setUnhelpful] = useState<string[]>([])

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const finish = () => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      preferredName: preferredName.trim() || undefined,
      supportStyle,
      triggers,
      whatHelps: helps,
      whatDoesntHelp: unhelpful,
      proactiveCheckIns: false,
      onboardedAt: new Date().toISOString(),
      onboardingCompleted: true
    }
    onComplete(profile)
  }

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-6 py-10 overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/welcome-mountains.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#E9F5F3]/70 via-[#DCEFEC]/55 to-[#CFEAE5]/80" />

      <div className="relative z-10 w-full max-w-sm bg-white/45 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(37,56,58,0.25)] px-8 py-12 flex flex-col justify-between" style={{ minHeight: '520px' }}>
      <div>
        <p className="font-sans text-[13px] tracking-[0.08em] text-mist mb-6">{step + 1} of {TOTAL_STEPS}</p>

        {step === 0 && (
          <div>
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-3">What should I call you?</h1>
            <p className="text-mist text-[14px] mb-10">A few quick things, then I'll get out of your way.</p>
            <input
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              placeholder="Optional"
              className="w-full bg-transparent text-[17px] text-ivory placeholder:text-mist/60 outline-none pb-3"
              style={{ borderBottom: '1px solid rgba(37,56,58,0.14)' }}
            />
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display font-light text-[26px] leading-snug text-ivory mb-1">Let's map your inner sky.</h1>
            <p className="text-mist text-[13px] mb-4">Tap what's true for you.</p>
            <ConstellationField
              options={TRIGGER_OPTIONS}
              selected={triggers}
              onToggle={v => toggle(triggers, setTriggers, v)}
              color="#D9BE8F"
              orbColor="#4FAE9E"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10">When something's off, what do you want first?</h1>
            <div>
              {SUPPORT_STYLES.map((s, i) => (
                <button
                  key={s.value}
                  onClick={() => setSupportStyle(s.value)}
                  style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(37,56,58,0.08)' }}
                  className="w-full text-left py-4"
                >
                  <p className={`text-[19px] transition-colors duration-300 ${supportStyle === s.value ? 'text-bronze' : 'text-ivory'}`}>{s.label}</p>
                  <p className="text-[14px] text-mist mt-1">{s.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display font-light text-[26px] leading-snug text-ivory mb-1">What lights your way?</h1>
            <p className="text-mist text-[13px] mb-4">Tap what's helped before.</p>
            <ConstellationField
              options={HELPS_OPTIONS}
              selected={helps}
              onToggle={v => toggle(helps, setHelps, v)}
              color="#7FCFC0"
              orbColor="#B8935A"
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10">Anything that never helps?</h1>
            <div className="flex flex-wrap gap-x-7 gap-y-5">
              {UNHELPFUL_OPTIONS.map(u => (
                <TextToggle key={u} label={u} selected={unhelpful.includes(u)} onClick={() => toggle(unhelpful, setUnhelpful, u)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-10">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s => (s - 1) as Step)(step))}>Back</Button>
        ) : <span />}
        {step < 4 ? (
          <Button onClick={() => setStep((s => (s + 1) as Step)(step))}>{step === 1 ? 'Save my sky' : 'Continue'}</Button>
        ) : (
          <Button onClick={finish}>Start</Button>
        )}
      </div>
      </div>
    </div>
  )
}
