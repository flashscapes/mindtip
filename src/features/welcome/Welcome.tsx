import { useState } from 'react'

interface WelcomeProps {
  onComplete: () => void
}

const STEPS = [
  {
    headline: 'Welcome to MindTip',
    body: "A companion that remembers what actually helps you. MindTip learns your patterns and what's worked before, so every check-in gets sharper."
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
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-8 overflow-hidden bg-gradient-to-br from-[#E9F5F3] via-[#DCEFEC] to-[#CFEAE5]">
      {/* Soft abstract "aurora" background — stays inside the app's own aqua/bronze palette rather than a stock photo, so it's licence-free and always matches the brand. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#7FCFC0] opacity-40 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-[#B8935A] opacity-25 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#4FAE9E] opacity-30 blur-3xl" />
      </div>

      {/* Frosted glass card */}
      <div className="relative z-10 w-full max-w-sm bg-white/45 backdrop-blur-xl border border-white/60 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(37,56,58,0.25)] px-10 py-14 text-center">
        <p className="font-sans text-[13px] tracking-[0.08em] text-mist mb-8">{step + 1} of 2</p>
        <p className="font-display font-light text-[30px] leading-snug text-ivory mb-4">{headline}</p>
        <p className="font-sans text-[15px] text-mist leading-relaxed mb-12">{body}</p>

        <button
          onClick={() => (step === 0 ? setStep(1) : onComplete())}
          className="w-full bg-gradient-to-r from-[#B8935A] to-[#A5804B] text-white font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(184,147,90,0.6)] hover:shadow-[0_14px_36px_-8px_rgba(184,147,90,0.7)] hover:-translate-y-0.5 transition-all duration-300"
        >
          {step === 0 ? 'Next' : 'Begin'}
        </button>

        {step === 1 && (
          <button
            onClick={() => setStep(0)}
            className="mt-6 font-sans text-[13px] text-mist hover:text-bronze transition-colors duration-300"
          >
            Back
          </button>
        )}
      </div>
    </div>
  )
}
