import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface WelcomeProps {
  onComplete: () => void
}

const STEPS = [
  {
    headline: 'Welcome to MindTip',
    body: "A companion that remembers what actually helps you — not the same breathing exercise for everyone. MindTip learns your patterns and what's worked before, so every check-in gets sharper."
  },
  {
    headline: 'Brief check-in, fast action',
    body: "No lingering in open-ended venting. MindTip leads with quick validation, then moves straight into a concrete next step — and remembers what worked, so next time is faster."
  }
] as const

export function Welcome({ onComplete }: WelcomeProps) {
  const [step, setStep] = useState<0 | 1>(0)
  const { headline, body } = STEPS[step]

  return (
    <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-8 text-center">
      <p className="font-sans text-[13px] tracking-[0.08em] text-mist mb-8">{step + 1} of 2</p>
      <p className="font-display font-light text-[30px] leading-snug text-ivory mb-4 max-w-[280px]">{headline}</p>
      <p className="font-sans text-[15px] text-mist max-w-[280px] mb-14 leading-relaxed">{body}</p>
      <Button onClick={() => (step === 0 ? setStep(1) : onComplete())}>
        {step === 0 ? 'Next' : 'Begin'}
      </Button>
      {step === 1 && (
        <button
          onClick={() => setStep(0)}
          className="mt-6 font-sans text-[13px] text-mist hover:text-bronze transition-colors duration-300"
        >
          Back
        </button>
      )}
    </div>
  )
}
