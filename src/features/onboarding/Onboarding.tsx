import { useState } from 'react'
import type { SupportStyle, UserProfile } from '@/types'
import { HELPS_OPTIONS, TRIGGER_OPTIONS, UNHELPFUL_OPTIONS } from '@/lib/constants'
import { TextToggle } from '@/components/ui/TextToggle'
import { Button } from '@/components/ui/Button'

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void
}

// Used only by the triggers screen (step 1) below. The glow/dot styling is
// a purely visual skin — the actual tap target is a real button padded to
// a 44pt-minimum height, matching Apple's own guidance for reliable
// tapping, laid out with a plain wrapping flex (the same reliable
// mechanism as TextToggle elsewhere in this file), never fragile
// fixed-position placement.
function StarChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  const AMBER = '#D9BE8F'
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-3 rounded-full transition-all duration-300"
      style={{ minHeight: 44 }}
    >
      <span
        className="rounded-full shrink-0 transition-all duration-300"
        style={{
          width: selected ? 10 : 7,
          height: selected ? 10 : 7,
          background: AMBER,
          boxShadow: selected ? `0 0 10px 3px ${AMBER}99` : 'none',
          opacity: selected ? 1 : 0.55
        }}
      />
      <span className="text-[13px] transition-colors duration-300" style={{ color: selected ? AMBER : `${AMBER}99` }}>
        {label}
      </span>
    </button>
  )
}

const SUPPORT_STYLES: { value: SupportStyle; label: string; description: string }[] = [
  { value: 'validate_first', label: 'Validate me first', description: 'Let me feel heard before we talk about what to do.' },
  { value: 'action_first', label: 'Give me the plan', description: 'Skip ahead — tell me what to actually do.' },
  { value: 'blend', label: 'A little of both', description: 'Quick acknowledgment, then straight to action.' }
]

// Six short questions, each answerable in a few seconds — the full flow
// is designed to take roughly 60-90 seconds end to end. Shown once, on
// first launch; App.tsx gates on the persistent onboardingCompleted flag.
const TOTAL_STEPS = 6
type Step = 0 | 1 | 2 | 3 | 4 | 5

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<Step>(0)
  const [preferredName, setPreferredName] = useState('')
  const [triggers, setTriggers] = useState<string[]>([])
  const [supportStyle, setSupportStyle] = useState<SupportStyle>('blend')
  const [helps, setHelps] = useState<string[]>([])
  const [unhelpful, setUnhelpful] = useState<string[]>([])
  const [proactiveCheckIns, setProactiveCheckIns] = useState<boolean | null>(null)

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  const canAdvance = step !== 5 || proactiveCheckIns !== null

  const finish = () => {
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      preferredName: preferredName.trim() || undefined,
      supportStyle,
      triggers,
      whatHelps: helps,
      whatDoesntHelp: unhelpful,
      proactiveCheckIns: proactiveCheckIns ?? false,
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
        <p className="font-sans text-[13px] tracking-[0.08em] text-mist mb-14">{step + 1} of {TOTAL_STEPS}</p>

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
            <h1 className="font-display font-light text-[26px] leading-snug text-ivory mb-2">What tends to get under your skin?</h1>
            <p className="text-mist text-[13px] mb-6">Tap what's true for you.</p>

            <div className="relative rounded-2xl p-5 overflow-hidden" style={{ background: 'radial-gradient(circle at 50% 12%, #1B3A3E, #0E2124)' }}>
              {/* Purely decorative twinkles and center orb — atmosphere
                  only, never a tap target, so they carry zero reliability
                  risk. */}
              <div className="absolute rounded-full pointer-events-none" style={{ width: 3, height: 3, top: '14%', left: '88%', background: '#7FCFC0', opacity: 0.4 }} />
              <div className="absolute rounded-full pointer-events-none" style={{ width: 2, height: 2, top: '75%', left: '6%', background: '#D9BE8F', opacity: 0.35 }} />
              <div className="absolute rounded-full pointer-events-none" style={{ width: 2, height: 2, top: '45%', left: '93%', background: '#7FCFC0', opacity: 0.3 }} />

              <div className="flex justify-center mb-4">
                <div
                  className="rounded-full"
                  style={{ width: 26, height: 26, background: 'radial-gradient(circle at 35% 30%, #9AD9CC, #4FAE9E)', boxShadow: '0 0 16px 4px rgba(154,217,204,0.45)' }}
                />
              </div>

              <div className="flex flex-wrap justify-center gap-x-1 gap-y-1">
                {TRIGGER_OPTIONS.map(t => (
                  <StarChip key={t} label={t} selected={triggers.includes(t)} onClick={() => toggle(triggers, setTriggers, t)} />
                ))}
              </div>
            </div>
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
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10">What's actually helped before?</h1>
            <div className="flex flex-wrap gap-x-7 gap-y-5">
              {HELPS_OPTIONS.map(h => (
                <TextToggle key={h} label={h} selected={helps.includes(h)} onClick={() => toggle(helps, setHelps, h)} />
              ))}
            </div>
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

        {step === 5 && (
          <div>
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10">Want the occasional nudge from me?</h1>
            <div>
              <button onClick={() => setProactiveCheckIns(true)} className="w-full text-left py-4">
                <p className={`text-[19px] transition-colors duration-300 ${proactiveCheckIns === true ? 'text-bronze' : 'text-ivory'}`}>Yes, sometimes</p>
                <p className="text-[14px] text-mist mt-1">A quiet check-in around known hard moments, like Sunday evenings.</p>
              </button>
              <button
                onClick={() => setProactiveCheckIns(false)}
                className="w-full text-left py-4"
                style={{ borderTop: '1px solid rgba(37,56,58,0.08)' }}
              >
                <p className={`text-[19px] transition-colors duration-300 ${proactiveCheckIns === false ? 'text-bronze' : 'text-ivory'}`}>No, only when I reach out</p>
                <p className="text-[14px] text-mist mt-1">I'll stay quiet until you start a conversation.</p>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-10">
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep((s => (s - 1) as Step)(step))}>Back</Button>
        ) : <span />}
        {step < 5 ? (
          <Button onClick={() => setStep((s => (s + 1) as Step)(step))}>{step === 1 ? 'Save my sky' : 'Continue'}</Button>
        ) : (
          <Button onClick={finish} disabled={!canAdvance}>Start</Button>
        )}
      </div>
      </div>
    </div>
  )
}
