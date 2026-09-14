interface WelcomeProps {
  onComplete: () => void
}

// A small, decorative "premium" lens-glare accent — a soft bright core plus
// a thin horizontal streak, blended with `screen` so it brightens whatever
// sits behind it rather than covering it like a flat sticker. Purely
// cosmetic, sits under the title text.
function LensGlare() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ bottom: -10, width: 220, height: 46, mixBlendMode: 'screen' }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 90,
          height: 34,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,250,235,0.95) 0%, rgba(255,220,160,0.5) 35%, rgba(255,200,140,0) 75%)',
          filter: 'blur(2px)'
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '100%',
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,235,200,0.85) 50%, transparent 100%)'
        }}
      />
    </div>
  )
}

export function Welcome({ onComplete }: WelcomeProps) {
  return (
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{
        backgroundImage: "url('/images/welcome-hero.jpg')",
        backgroundSize: '100% auto',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#1a1206'
      }}
    >
      {/* Readability wash — lightest over the portraits at the very top
          (already dark), deepest by the time it reaches the bright sky
          where the title sits, then fading toward the fallback color below
          the image's own bottom edge so the transition isn't an abrupt seam. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.1) 0%, rgba(5,5,10,0.25) 22%, rgba(5,5,10,0.55) 45%, rgba(10,7,3,0.8) 70%, #1a1206 100%)' }}
      />

      {/* Spacer pushes the title block to land roughly a third of the way
          down the screen, below the five character portraits. */}
      <div style={{ height: '33vh', flexShrink: 0 }} />

      <div className="relative z-10 flex flex-col items-center px-6 text-center w-full max-w-sm mx-auto">
        <div className="relative">
          <p
            className="font-sans text-[64px] leading-[0.9] tracking-[0.04em]"
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              backgroundImage: 'linear-gradient(135deg, #8FD4F0 0%, #EAF6FF 28%, #FFFFFF 48%, #FFA35C 68%, #FF6B2E 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.6))'
            }}
          >
            MINDTIP
          </p>
          <LensGlare />
        </div>
        <p className="font-display italic text-[18px] mt-1.5 mb-1.5" style={{ color: '#E8C878' }}>
          Therapy
        </p>
        <p
          className="text-[13px] tracking-[0.15em]"
          style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878' }}
        >
          FRESH PERSPECTIVES THROUGH<br />DYNAMIC ROLES
        </p>
        <p className="font-display text-[15px] leading-relaxed mt-4 max-w-[240px]" style={{ color: '#F0EEE8' }}>
          Choose a character. Talk through what's on your mind. Leave with a brand-new lens on your life.
        </p>
      </div>

      <div className="flex-1" />

      <button
        onClick={onComplete}
        className="relative z-10 self-center mb-8 rounded-full transition-transform duration-300 hover:-translate-y-0.5"
        style={{
          border: '1.5px solid #D4A94A',
          background: 'rgba(10,14,20,0.6)',
          padding: '12px 34px'
        }}
      >
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878', fontSize: 16, letterSpacing: '0.1em' }}>
          NEXT →
        </span>
      </button>
    </div>
  )
}
