// The History Professor's chat atmosphere: a mahogany desk with a sheet of
// light-yellow college-ruled paper resting on it, plus a pocket watch and
// a fountain pen resting in the bottom corners like they've been set down
// mid-conversation. Purely decorative (pointer-events-none), sits behind
// the header/messages/input in Conversation.tsx -- the wood texture itself
// is applied as the screen's background (characterThemes.ts), so this
// component only needs to paint the paper sheet and the two props.
export function StudyDesk() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ margin: 14 }}>
      <div
        className="absolute inset-0 rounded-md"
        style={{
          background: '#FBF3D5',
          backgroundImage: 'repeating-linear-gradient(180deg, transparent 0px, transparent 27px, rgba(70,100,160,0.28) 27px, rgba(70,100,160,0.28) 28px)',
          backgroundPosition: '0 58px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.28), 0 16px 34px rgba(0,0,0,0.5), inset 0 0 50px rgba(139,110,60,0.08)'
        }}
      />
      <div className="absolute left-9 top-0 bottom-0 w-px" style={{ background: 'rgba(190,60,60,0.38)' }} />

      <svg viewBox="0 0 100 100" className="absolute bottom-28 left-2 w-14 h-14" style={{ transform: 'rotate(-8deg)', filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.4))' }}>
        <defs>
          <radialGradient id="mindtipWatchGold" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#F3DFA0" />
            <stop offset="55%" stopColor="#C9A227" />
            <stop offset="100%" stopColor="#8A6A18" />
          </radialGradient>
        </defs>
        <line x1="50" y1="12" x2="50" y2="20" stroke="#8A6A18" strokeWidth="2.5" />
        <circle cx="50" cy="10" r="4" fill="none" stroke="#8A6A18" strokeWidth="2.5" />
        <rect x="45" y="17" width="10" height="7" rx="1.5" fill="#8A6A18" />
        <circle cx="50" cy="55" r="33" fill="url(#mindtipWatchGold)" />
        <circle cx="50" cy="55" r="26" fill="#F7F0DC" stroke="#8A6A18" strokeWidth="1" />
        <g stroke="#4A3A16" strokeWidth="1.4" strokeLinecap="round">
          <line x1="50" y1="32" x2="50" y2="36" />
          <line x1="50" y1="74" x2="50" y2="78" />
          <line x1="28" y1="55" x2="32" y2="55" />
          <line x1="68" y1="55" x2="72" y2="55" />
        </g>
        <line x1="50" y1="55" x2="50" y2="38" stroke="#3A2E14" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="55" x2="63" y2="55" stroke="#3A2E14" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="55" r="2.2" fill="#3A2E14" />
      </svg>

      <svg viewBox="0 0 220 34" className="absolute bottom-32 right-4 w-24" style={{ transform: 'rotate(-32deg)', filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.4))' }}>
        <defs>
          <linearGradient id="mindtipPenBarrel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3A2C22" />
            <stop offset="50%" stopColor="#1A1410" />
            <stop offset="100%" stopColor="#0D0A08" />
          </linearGradient>
          <linearGradient id="mindtipPenGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8A6A18" />
            <stop offset="50%" stopColor="#F3DFA0" />
            <stop offset="100%" stopColor="#8A6A18" />
          </linearGradient>
        </defs>
        <rect x="30" y="9" width="180" height="16" rx="8" fill="url(#mindtipPenBarrel)" />
        <rect x="52" y="9" width="5" height="16" fill="url(#mindtipPenGold)" />
        <rect x="182" y="9" width="5" height="16" fill="url(#mindtipPenGold)" />
        <circle cx="212" cy="17" r="6" fill="url(#mindtipPenGold)" />
        <path d="M30 9 L4 17 L30 25 Z" fill="url(#mindtipPenGold)" />
        <line x1="8" y1="17" x2="26" y2="17" stroke="#4A3A16" strokeWidth="1" />
      </svg>
    </div>
  )
}
