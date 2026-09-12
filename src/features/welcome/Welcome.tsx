interface WelcomeProps {
  onComplete: () => void
}

// Real character portraits go here — paths match what will be dropped into
// public/assets/. Each card uses a layered CSS background (dark gradient +
// image), so until the real file exists at that path, the card still
// renders correctly as a styled dark frame with its label — no broken
// image icons, no code changes needed once the real asset lands.
const CHARACTER_SLOTS = [
  { label: 'Astronaut', image: '/assets/astronaut.jpg' },
  { label: 'Olympic Runner', image: '/assets/runner.jpg' },
  { label: 'Action Hero', image: '/assets/action-hero.jpg' },
  { label: 'Arctic Survivalist', image: '/assets/survivalist.jpg' }
]

function CharacterCard({ label, image }: { label: string; image: string }) {
  return (
    <button
      className="group relative aspect-[4/5] rounded-2xl overflow-hidden transition-transform duration-300 hover:scale-[1.03]"
      style={{
        border: '1px solid rgba(255,255,255,0.2)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.5), 0 14px 34px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)'
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-110"
        style={{
          backgroundImage: `linear-gradient(160deg, rgba(20,26,34,0.55), rgba(8,11,15,0.85)), url('${image}')`
        }}
      />
      {/* Dark overlay that brightens slightly on hover, per spec */}
      <div className="absolute inset-0 bg-black/25 group-hover:bg-black/10 transition-colors duration-300" />
      {/* Illuminating border glow on hover */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ boxShadow: 'inset 0 0 0 1.5px rgba(212,175,110,0.8), 0 0 20px 2px rgba(212,175,110,0.35)' }}
      />
      <p
        className="absolute bottom-2 left-0 right-0 text-center font-sans text-[11px] tracking-[0.06em] text-white/90"
        style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
      >
        {label}
      </p>
    </button>
  )
}

export function Welcome({ onComplete }: WelcomeProps) {
  return (
    <div
      className="relative min-h-dvh flex flex-col items-center justify-center px-6 py-10 overflow-hidden"
      style={{ background: 'linear-gradient(160deg, #262C36, #14181F 60%, #0A0D12)' }}
    >
      {/* Central radial glow */}
      <div
        className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(212,175,110,0.18), transparent 70%)' }}
      />
      {/* Faint circuit-line texture */}
      <div
        className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '38px 38px'
        }}
      />
      {/* Mechanical globe/gear graphic behind the title */}
      <svg viewBox="0 0 200 200" className="absolute top-[26%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 opacity-25 pointer-events-none">
        <circle cx="100" cy="100" r="70" fill="none" stroke="#D4AF6E" strokeWidth="1" />
        <circle cx="100" cy="100" r="55" fill="none" stroke="#D4AF6E" strokeWidth="0.5" strokeDasharray="3 5" />
        <path d="M100 30 A70 70 0 0 1 165 100" fill="none" stroke="#D4AF6E" strokeWidth="1.5" />
        <path d="M100 170 A70 70 0 0 1 35 100" fill="none" stroke="#D4AF6E" strokeWidth="1.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <circle key={deg} cx={100 + 85 * Math.cos((deg * Math.PI) / 180)} cy={100 + 85 * Math.sin((deg * Math.PI) / 180)} r="3" fill="#D4AF6E" />
        ))}
      </svg>

      <div className="relative z-10 w-full max-w-sm">
        {/* Title badge */}
        <div className="text-center mb-5">
          <p
            className="font-sans font-black text-[13px] tracking-[0.3em] mb-1"
            style={{ color: 'rgba(255,255,255,0.55)' }}
          >
            WELCOME TO
          </p>
          <p
            className="font-sans font-black text-[36px] tracking-[0.08em]"
            style={{
              transform: 'skewX(-3deg)',
              backgroundImage: 'linear-gradient(180deg, #FFFFFF 20%, #B8BEC8 55%, #7A828F 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.35))'
            }}
          >
            MINDTIP
          </p>
        </div>

        {/* Four character cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {CHARACTER_SLOTS.map(slot => (
            <CharacterCard key={slot.label} label={slot.label} image={slot.image} />
          ))}
        </div>

        {/* Body copy panel */}
        <div
          className="rounded-2xl px-5 py-5 mb-6 text-center"
          style={{
            background: 'linear-gradient(160deg, rgba(30,36,44,0.6), rgba(12,15,20,0.7))',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          <p className="font-sans text-[13px] tracking-[0.25em] mb-3" style={{ color: '#D4AF6E' }}>
            --- ◆ ---
          </p>
          <p className="font-sans text-[14px] leading-relaxed" style={{ color: '#D8D2C4' }}>
            Explore life's challenges through the eyes of someone different — choose a character, step into their world, and see what they might say.
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onComplete}
          className="group relative w-full font-sans text-[15px] font-bold tracking-[0.06em] py-4 rounded-xl overflow-hidden transition-transform duration-300 hover:-translate-y-0.5"
          style={{
            color: '#3A2A0F',
            background: 'linear-gradient(180deg, #F0D9A0, #D4AF6E 45%, #A9823F)',
            boxShadow: '0 12px 28px -8px rgba(212,175,110,0.55), inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.25)'
          }}
        >
          {/* Shine sweep on hover */}
          <span
            className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
            style={{ background: 'linear-gradient(100deg, transparent 40%, rgba(255,255,255,0.5) 50%, transparent 60%)' }}
          />
          <span className="relative">NEXT</span>
        </button>
      </div>
    </div>
  )
}
