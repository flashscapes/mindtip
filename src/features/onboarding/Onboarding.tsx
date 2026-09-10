import { useState } from 'react'
import type { SupportStyle, UserProfile } from '@/types'
import { HELPS_OPTIONS, TRIGGER_OPTIONS } from '@/lib/constants'

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void
}

const SUPPORT_STYLES: { value: SupportStyle; label: string }[] = [
  { value: 'validate_first', label: 'Validate first' },
  { value: 'blend', label: 'A little of both' },
  { value: 'action_first', label: 'Give me the plan' }
]

// Two steps: name, then a single consolidated "sky" screen collecting
// triggers, what's helped, support style, and proactive check-ins together.
// ("What doesn't help" was deliberately dropped as the lowest-signal of the
// original five questions — see the onboarding redesign discussion.)
const TOTAL_STEPS = 2
type Step = 0 | 1

// A single tappable "star": a small glowing dot plus its label, padded into
// a comfortably large tap target (not just the dot itself) — the actual
// interaction is a plain, reliable wrapping flex layout under the hood,
// the glow is purely a visual skin on top of it.
function StarChip({
  label,
  selected,
  color,
  onClick
}: {
  label: string
  selected: boolean
  color: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-full transition-all duration-300"
      style={{ minHeight: 40 }}
    >
      <span
        className="rounded-full shrink-0 transition-all duration-300"
        style={{
          width: selected ? 10 : 7,
          height: selected ? 10 : 7,
          background: color,
          boxShadow: selected ? `0 0 10px 3px ${color}99` : 'none',
          opacity: selected ? 1 : 0.55
        }}
      />
      <span
        className="text-[13px] transition-colors duration-300"
        style={{ color: selected ? color : `${color}99` }}
      >
        {label}
      </span>
    </button>
  )
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(0)
  const [preferredName, setPreferredName] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [supportStyle, setSupportStyle] = useState<SupportStyle>('blend')
  const [helps, setHelps] = useState<string[]>([])
  const [proactiveCheckIns, setProactiveCheckIns] = useState<boolean | null>(null)

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const canAdvance = step !== 1 || proactiveCheckIns !== null

  const finish = () => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      preferredName: preferredName.trim() || undefined,
      supportStyle,
      triggers,
      whatHelps: helps,
      whatDoesntHelp: [],
      proactiveCheckIns: proactiveCheckIns ?? false,
      onboardedAt: new Date().toISOString(),
      onboardingCompleted: true
    }
    onComplete(profile)
  }

  const AMBER = '#D9BE8F'
  const AQUA = '#7FCFC0'
  const GOLD = '#F0DDA0'

  return (
    // No overflow-hidden here — this screen is genuinely taller than one
    // viewport with all 22 real options, so the page must be able to
    // scroll normally. min-h-dvh is a floor, not a cap, so this grows to
    // fit its content correctly either way.
    <div className="relative min-h-dvh flex flex-col items-center px-6 py-10">
      <div
        className="fixed inset-0 bg-cover bg-center -z-10"
        style={{ backgroundImage: "url('/images/welcome-mountains.jpg')" }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#E9F5F3]/70 via-[#DCEFEC]/55 to-[#CFEAE5]/80 -z-10" />

      <div className="relative z-10 w-full max-w-sm bg-white/45 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(37,56,58,0.25)] px-7 py-10 my-auto">
        <p className="font-sans text-[13px] tracking-[0.08em] text-mist mb-8">{step + 1} of {TOTAL_STEPS}</p>

        {step === 0 && (
          <div>
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-3">What should I call you?</h1>
            <p className="text-mist text-[14px] mb-10">A couple more things, then I'll get out of your way.</p>
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
            <h1 className="font-display font-light text-[22px] leading-snug text-ivory mb-1">Let's map your inner sky.</h1>
            <p className="text-mist text-[13px] mb-6">Tap what's true for you.</p>

            {/* Triggers */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'radial-gradient(circle at 50% 20%, #1B3A3E, #0E2124)' }}>
              <p className="text-[10px] tracking-[0.06em] mb-2" style={{ color: `${AMBER}80` }}>WHAT GETS UNDER YOUR SKIN</p>
              <div className="flex flex-wrap -m-1">
                {TRIGGER_OPTIONS.map(t => (
                  <StarChip key={t} label={t} color={AMBER} selected={triggers.includes(t)} onClick={() => toggle(triggers, setTriggers, t)} />
                ))}
              </div>
            </div>

            {/* What's helped */}
            <div className="rounded-2xl p-4 mb-4" style={{ background: 'radial-gradient(circle at 50% 20%, #142E32, #0A1B1D)' }}>
              <p className="text-[10px] tracking-[0.06em] mb-2" style={{ color: `${AQUA}80` }}>WHAT'S HELPED BEFORE</p>
              <div className="flex flex-wrap -m-1">
                {HELPS_OPTIONS.map(h => (
                  <StarChip key={h} label={h} color={AQUA} selected={helps.includes(h)} onClick={() => toggle(helps, setHelps, h)} />
                ))}
              </div>
            </div>

            {/* Support style — three guide stars, pick one */}
            <div className="rounded-2xl p-4 mb-6" style={{ background: 'radial-gradient(circle at 50% 20%, #24231B, #14130D)' }}>
              <p className="text-[10px] tracking-[0.06em] mb-3" style={{ color: `${GOLD}80` }}>WHEN SOMETHING'S OFF, I WANT</p>
              <div className="flex justify-between">
                {SUPPORT_STYLES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSupportStyle(s.value)}
                    className="flex flex-col items-center gap-2 px-2 py-2"
                    style={{ minWidth: 72, minHeight: 56 }}
                  >
                    <span
                      className="rounded-full transition-all duration-300"
                      style={{
                        width: supportStyle === s.value ? 14 : 9,
                        height: supportStyle === s.value ? 14 : 9,
                        background: GOLD,
                        boxShadow: supportStyle === s.value ? `0 0 12px 4px ${GOLD}99` : 'none',
                        opacity: supportStyle === s.value ? 1 : 0.5
                      }}
                    />
                    <span
                      className="text-[11px] text-center leading-tight transition-colors duration-300"
                      style={{ color: supportStyle === s.value ? GOLD : `${GOLD}90` }}
                    >
                      {s.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Proactive check-ins — kept as two clearly labeled options
                rather than a bare toggle, so the meaning of each choice is
                unambiguous. */}
            <p className="text-[15px] text-ivory mb-3">Want the occasional nudge from me?</p>
            <div className="flex flex-col gap-2 mb-2">
              <button
                type="button"
                onClick={() => setProactiveCheckIns(true)}
                className="w-full text-left px-4 py-3 rounded-xl transition-all duration-300"
                style={{
                  background: proactiveCheckIns === true ? 'rgba(184,147,90,0.15)' : 'rgba(255,255,255,0.35)',
                  border: proactiveCheckIns === true ? '1px solid rgba(184,147,90,0.5)' : '1px solid transparent'
                }}
              >
                <p className={`text-[15px] ${proactiveCheckIns === true ? 'text-bronze' : 'text-ivory'}`}>Yes, sometimes</p>
                <p className="text-[12px] text-mist mt-0.5">A quiet check-in around known hard moments, like Sunday evenings.</p>
              </button>
              <button
                type="button"
                onClick={() => setProactiveCheckIns(false)}
                className="w-full text-left px-4 py-3 rounded-xl transition-all duration-300"
                style={{
                  background: proactiveCheckIns === false ? 'rgba(184,147,90,0.15)' : 'rgba(255,255,255,0.35)',
                  border: proactiveCheckIns === false ? '1px solid rgba(184,147,90,0.5)' : '1px solid transparent'
                }}
              >
                <p className={`text-[15px] ${proactiveCheckIns === false ? 'text-bronze' : 'text-ivory'}`}>No, only when I reach out</p>
                <p className="text-[12px] text-mist mt-0.5">I'll stay quiet until you start a conversation.</p>
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-8">
          {step > 0 ? (
            <button onClick={() => setStep(0)} className="text-[15px] text-ivory hover:text-bronze transition-colors duration-300">Back</button>
          ) : <span />}
          {step === 0 ? (
            <button onClick={() => setStep(1)} className="text-[15px] font-normal text-bronze hover:opacity-80 transition-colors duration-300">Continue</button>
          ) : (
            <button
              onClick={finish}
              disabled={!canAdvance}
              className="text-[15px] font-normal text-bronze hover:opacity-80 transition-colors duration-300 disabled:opacity-30"
            >
              Save my sky
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
