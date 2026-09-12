interface WelcomeProps {
  onComplete: () => void
}

// Four character portrait slots — PLACEHOLDER FRAMEWORK ONLY. Real character
// art gets supplied separately and dropped in here; each slot just needs its
// `image` path set once assets exist (e.g. '/images/characters/astronaut.jpg').
// Until then, each renders as a clearly labeled placeholder frame in the
// exact position/size the real art will occupy — swap `image: undefined` for
// a real path and the placeholder disappears automatically.
const CHARACTER_SLOTS: { label: string; image?: string }[] = [
  { label: 'Astronaut' },
  { label: 'Olympic Runner' },
  { label: 'Action Hero' },
  { label: 'Arctic Survivalist' }
]

function CharacterFrame({ label, image }: { label: string; image?: string }) {
  return (
    <div
      className="relative aspect-[4/5] rounded-2xl overflow-hidden"
      style={{
        border: '2px solid rgba(180,150,90,0.5)',
        boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 12px 30px -8px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.4)'
      }}
    >
      {image ? (
        <img src={image} alt={label} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-center px-2"
          style={{ background: 'linear-gradient(160deg, #1A2028, #0D1116)' }}
        >
          <p className="font-sans text-[11px] tracking-[0.06em] text-[#C9A876]/70">{label}</p>
        </div>
      )}
    </div>
  )
}

export function Welcome({ onComplete }: WelcomeProps) {
  return (
    <div
      className="relative min-h-dvh flex flex-col items-center justify-center px-6 py-10 overflow-hidden"
      style={{
        background: 'radial-gradient(circle at 50% 30%, #1C222B, #0A0D12 75%)'
      }}
    >
      {/* Faint circuit-line texture — purely atmospheric */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(rgba(180,150,90,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(180,150,90,0.15) 1px, transparent 1px)',
          backgroundSize: '38px 38px'
        }}
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Four character frames, MindTip title overlapping the center */}
        <div className="relative grid grid-cols-2 gap-3 mb-2">
          {CHARACTER_SLOTS.map(slot => (
            <CharacterFrame key={slot.label} label={slot.label} image={slot.image} />
          ))}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p
              className="font-sans font-black text-[15px] tracking-[0.15em] text-center leading-tight px-4 py-3 rounded-xl"
              style={{
                color: '#EFE6D0',
                background: 'rgba(10,13,18,0.85)',
                border: '1px solid rgba(180,150,90,0.4)',
                textShadow: '0 0 12px rgba(180,150,90,0.5)'
              }}
            >
              WELCOME TO<br />
              <span className="text-[22px]">MINDTIP</span>
            </p>
          </div>
        </div>

        <p className="font-sans text-[14px] text-[#D8D2C4]/85 leading-relaxed text-center mt-6 mb-8">
          Explore life's challenges through the eyes of someone different — choose a character, step into their world, and see what they might say.
        </p>

        <button
          onClick={onComplete}
          className="w-full font-sans text-[15px] font-semibold tracking-[0.04em] py-4 rounded-full transition-all duration-300 hover:-translate-y-0.5"
          style={{
            color: '#1A1409',
            background: 'linear-gradient(180deg, #E8CC8F, #B4954A)',
            boxShadow: '0 10px 24px -6px rgba(180,150,90,0.5), inset 0 1px 0 rgba(255,255,255,0.4)'
          }}
        >
          Next
        </button>
      </div>
    </div>
  )
}
