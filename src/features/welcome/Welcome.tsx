interface WelcomeProps {
  onComplete: () => void
}

export function Welcome({ onComplete }: WelcomeProps) {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center px-8 overflow-hidden">
      {/* Nature photo background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/images/welcome-mountains.jpg')" }}
      />
      {/* Muted color wash — softens the photo's raw saturation and keeps it inside the app's own aqua palette, rather than a vivid, high-contrast travel photo look */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#E9F5F3]/25 via-[#DCEFEC]/18 to-[#CFEAE5]/32" />

      {/* Frosted glass card — contrast comes from a strong shadow and a hairline
          edge, not just fill opacity, so the card reads clearly against any
          part of the photo (including bright snow/sky), not just darker areas. */}
      <div
        className="relative z-10 w-full max-w-sm rounded-[28px] px-10 py-14 text-center"
        style={{
          background: 'rgba(255,255,255,0.88)',
          boxShadow: '0 26px 60px -12px rgba(0,0,0,0.45), 0 6px 16px -4px rgba(0,0,0,0.28), 0 0 0 1px rgba(0,0,0,0.05)'
        }}
      >
        <p className="font-display font-light text-[30px] leading-snug text-ivory mb-4">Welcome to MindTip</p>
        <p className="font-sans text-[15px] text-mist leading-relaxed mb-12">
          MindTip helps you see what's really going on and know exactly what to do next — learning more about you with every conversation.
        </p>

        <button
          onClick={onComplete}
          className="w-full bg-gradient-to-r from-[#B8935A] to-[#A5804B] text-white font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(184,147,90,0.6)] hover:shadow-[0_14px_36px_-8px_rgba(184,147,90,0.7)] hover:-translate-y-0.5 transition-all duration-300"
        >
          Begin
        </button>
      </div>
    </div>
  )
}
