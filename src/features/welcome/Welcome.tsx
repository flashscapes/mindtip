interface WelcomeProps {
  onComplete: () => void
}

// Five character portrait slots — PLACEHOLDER FRAMEWORK ONLY. Real character
// photos get supplied separately; set `image` on any slot once an asset
// exists (e.g. '/assets/astronaut.jpg') and the placeholder panel is
// replaced automatically, no other code changes needed. The first slot
// renders a simple fedora-and-silhouette shape instead of a label — a
// generic adventurer archetype, not a likeness of anyone specific.
const CHARACTER_SLOTS: { image?: string; silhouette?: boolean }[] = [
  { silhouette: true },
  {},
  {},
  {},
  {}
]

function CharacterPanel({ image, silhouette, clipPath, marginLeft }: { image?: string; silhouette?: boolean; clipPath: string; marginLeft?: number }) {
  return (
    <div
      className="relative flex-1 overflow-hidden"
      style={{
        clipPath,
        marginLeft: marginLeft ? `${marginLeft}px` : undefined,
        background: image ? undefined : 'linear-gradient(160deg, #242C38, #0A0E14)',
        backgroundImage: image ? `linear-gradient(160deg, rgba(20,26,34,0.4), rgba(8,11,15,0.75)), url('${image}')` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {silhouette && !image && (
        <svg viewBox="0 0 60 100" className="absolute bottom-0 left-2 w-[70%] h-[90%]">
          <ellipse cx="30" cy="30" rx="14" ry="16" fill="#05070A" />
          <path d="M8 26 Q30 6 52 26 Q52 32 44 30 Q30 22 16 30 Q8 32 8 26 Z" fill="#05070A" />
          <path d="M14 44 Q30 34 46 44 L50 100 L10 100 Z" fill="#05070A" />
        </svg>
      )}
    </div>
  )
}

export function Welcome({ onComplete }: WelcomeProps) {
  return (
    <div
      className="relative min-h-dvh flex flex-col items-center overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0D1420 0%, #1A2740 45%, #3D5470 65%, #E8A855 80%, #7A9BC2 100%)' }}
    >
      {/* Five angled character panels */}
      <div className="relative w-full flex" style={{ height: '28vh', minHeight: 180 }}>
        <CharacterPanel {...CHARACTER_SLOTS[0]} clipPath="polygon(0 0, 100% 0, 85% 100%, 0 100%)" />
        <CharacterPanel {...CHARACTER_SLOTS[1]} clipPath="polygon(15% 0, 100% 0, 100% 100%, 0 100%)" marginLeft={-14} />
        <CharacterPanel {...CHARACTER_SLOTS[2]} clipPath="polygon(15% 0, 100% 0, 85% 100%, 0 100%)" marginLeft={-14} />
        <CharacterPanel {...CHARACTER_SLOTS[3]} clipPath="polygon(15% 0, 100% 0, 100% 100%, 0 100%)" marginLeft={-14} />
        <CharacterPanel {...CHARACTER_SLOTS[4]} clipPath="polygon(15% 0, 100% 0, 100% 100%, 0 100%)" marginLeft={-14} />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center w-full max-w-sm">
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

      <button
        onClick={onComplete}
        className="relative z-10 mb-8 rounded-full transition-transform duration-300 hover:-translate-y-0.5"
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
