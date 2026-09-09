import { useState } from 'react'
import type { SupportStyle, UserProfile } from '@/types'
import { HELPS_OPTIONS, TRIGGER_OPTIONS, UNHELPFUL_OPTIONS } from '@/lib/constants'
import { TextToggle } from '@/components/ui/TextToggle'
import { Button } from '@/components/ui/Button'

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void
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
    <div className="min-h-dvh bg-canvas flex flex-col justify-between px-8 py-16 max-w-sm mx-auto">
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
            <h1 className="font-display font-light text-[30px] leading-snug text-ivory mb-10">What tends to get under your skin?</h1>
            <div className="flex flex-wrap gap-x-7 gap-y-5">
              {TRIGGER_OPTIONS.map(t => (
                <TextToggle key={t} label={t} selected={triggers.includes(t)} onClick={() => toggle(triggers, setTriggers, t)} />
              ))}
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
          <Button onClick={() => setStep((s => (s + 1) as Step)(step))}>Continue</Button>
        ) : (
          <Button onClick={finish} disabled={!canAdvance}>Start</Button>
        )}
      </div>
    </div>
  )
}
