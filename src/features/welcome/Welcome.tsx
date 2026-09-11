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
    body: "MindTip helps you see what's really going on and know exactly what to do next — learning more about you with every conversation."
  }
] as const

export function Welcome({ onComplete }: WelcomeProps) {
  const [step, setStep] = useState<0 | 1>(0)
  const { headline, body } = STEPS[step]

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-8 overflow-hidden">
      {/* Nature photo background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/welcome-mountains.jpg')" }}
      />
      {/* Muted color wash — softens the photo's raw saturation and keeps it inside the app's own aqua palette, rather than a vivid, high-contrast travel photo look */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#E9F5F3]/25 via-[#DCEFEC]/18 to-[#CFEAE5]/32" />

      {/* Frosted glass card */}
      <div className="relative z-10 w-full max-w-sm bg-white/92 backdrop-blur-xl border border-white/95 rounded-[28px] shadow-[0_20px_60px_-15px_rgba(37,56,58,0.25)] px-10 py-14 text-center">
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
