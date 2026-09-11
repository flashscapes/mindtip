import { tapHaptic } from '@/lib/haptics'
import { useState } from 'react'
import type { UserProfile } from '@/types'
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
      style={{ background: `radial-gradient(circle at 50% 45%, ${orbColor}33, #060F10)` }}
    >
      {options.map((opt, i) => {
        const p = STAR_POSITIONS[i]
        if (!p || !selected.includes(opt)) return null
        return <line key={`line-${opt}`} x1={p.x} y1={p.y} x2={ORB_X} y2={ORB_Y} stroke={color} strokeWidth="1.8" opacity="0.95" />
      })}

      <circle cx={ORB_X} cy={ORB_Y} r="13" fill={orbColor} />
      <circle cx={ORB_X} cy={ORB_Y} r="13" fill="none" stroke={color} strokeWidth="2" opacity="0.75" />

      {options.map((opt, i) => {
        const p = STAR_POSITIONS[i]
        if (!p) return null
        const isSelected = selected.includes(opt)
        return (
          <g key={opt} onClick={() => { tapHaptic(); onToggle(opt) }} style={{ cursor: 'pointer' }}>
            <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={isSelected ? 7 : 4}
              fill={color}
              opacity={isSelected ? 1 : 0.75}
              style={{
                transition: 'r 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s',
                filter: isSelected ? `drop-shadow(0 0 6px ${color})` : 'none'
              }}
            />
            <text
              x={p.x}
              y={p.y + p.labelDy}
              fill={color}
              fontSize={isSelected ? 12 : 11}
              textAnchor="middle"
              opacity={isSelected ? 1 : 0.95}
            >
              {opt}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// Four steps: name, triggers (constellation), helps (constellation), what
// doesn't help. Support style was removed entirely — confirmed it's
// actively used in the system prompt (unlike proactive check-ins, which
// was truly inert), but 'blend' already matches the app's own stated
// default philosophy ("brief validation, then fast action"), so everyone
// now simply gets that baseline instead of being asked to choose before
// their first conversation. Proactive check-ins was removed earlier for
// the same reason as before (confirmed unused anywhere in the app).
const TOTAL_STEPS = 4
type Step = 0 | 1 | 2 | 3

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(0)
  const [preferredName, setPreferredName] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [helps, setHelps] = useState<string[]>([])
  const [unhelpful, setUnhelpful] = useState<string[]>([])

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const finish = () => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      preferredName: preferredName.trim() || undefined,
      supportStyle: 'blend',
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
      <div className="absolute inset-0 bg-gradient-to-b from-[#E9F5F3]/25 via-[#DCEFEC]/18 to-[#CFEAE5]/32" />

      <div className="relative z-10 w-full max-w-sm rounded-[28px] px-8 py-12 flex flex-col justify-between" style={{ minHeight: '520px', background: 'rgba(255,255,255,0.88)', boxShadow: '0 26px 60px -12px rgba(0,0,0,0.45), 0 6px 16px -4px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.05)' }}>
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
            <div className="-mx-5">
              <ConstellationField
                options={TRIGGER_OPTIONS}
                selected={triggers}
                onToggle={v => toggle(triggers, setTriggers, v)}
                color="#D9BE8F"
                orbColor="#4FAE9E"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display font-light text-[26px] leading-snug text-ivory mb-1">What lights your way?</h1>
            <p className="text-mist text-[13px] mb-4">Tap what's helped before.</p>
            <div className="-mx-5">
              <ConstellationField
                options={HELPS_OPTIONS}
                selected={helps}
                onToggle={v => toggle(helps, setHelps, v)}
                color="#7FCFC0"
                orbColor="#B8935A"
              />
            </div>
          </div>
        )}

        {step === 3 && (
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
        {step < 3 ? (
          <Button onClick={() => setStep((s => (s + 1) as Step)(step))}>{step === 1 ? 'Save my sky' : 'Continue'}</Button>
        ) : (
          <Button onClick={finish}>Start</Button>
        )}
      </div>
      </div>
    </div>
  )
}
