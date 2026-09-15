// The Frontline Infantry Man's chat atmosphere: a dusty olive-drab dusk
// with real atmospheric layering -- a hazy far ridge, a scrub-textured mid
// slope, a dark foreground ridge with a barbed-wire fence line and sandbag
// positions, a low warm sun with a dust-haze glow, a detailed watchtower
// (cross-bracing, antenna, blinking light), and drifting dust motes.
// Deliberately non-graphic throughout -- no weapons, no combat imagery.
export function InfantryCamp() {
  return (
    <svg
      viewBox="0 0 320 600"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <radialGradient id="mindtipSunHaze" cx="68%" cy="58%" r="35%">
          <stop offset="0%" stopColor="#FFE8B0" stopOpacity="0.75" />
          <stop offset="50%" stopColor="#F0C878" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#F0C878" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mindtipRidgeFar2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8A8560" />
          <stop offset="100%" stopColor="#6B6540" />
        </linearGradient>
        <linearGradient id="mindtipRidgeMid2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5C6440" />
          <stop offset="100%" stopColor="#3E4A2C" />
        </linearGradient>
        <linearGradient id="mindtipRidgeNear2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#262E1A" />
          <stop offset="100%" stopColor="#161C0E" />
        </linearGradient>
      </defs>

      <circle cx="222" cy="352" r="26" fill="#FFF0C8" opacity="0.85" />
      <ellipse cx="210" cy="360" rx="180" ry="130" fill="url(#mindtipSunHaze)" />

      <path d="M0 330 L45 305 L90 320 L140 295 L190 315 L235 300 L280 318 L320 302 L320 600 L0 600 Z" fill="url(#mindtipRidgeFar2)" opacity="0.65" />
      <path d="M0 390 L35 355 L70 375 L105 340 L95 350 L130 385 L170 350 L210 385 L245 355 L285 380 L320 360 L320 600 L0 600 Z" fill="url(#mindtipRidgeMid2)" />
      <g fill="#4A5230" opacity="0.5">
        <circle cx="60" cy="378" r="3" /><circle cx="150" cy="368" r="4" /><circle cx="260" cy="372" r="3" />
      </g>

      <path d="M0 470 L30 445 L45 460 L70 430 L60 445 L95 475 L130 440 L120 455 L165 480 L200 448 L240 470 L275 450 L320 468 L320 600 L0 600 Z" fill="url(#mindtipRidgeNear2)" />

      <g stroke="#161C0E" strokeWidth="1.5" opacity="0.8">
        <line x1="30" y1="450" x2="34" y2="435" /><line x1="34" y1="435" x2="30" y2="440" /><line x1="34" y1="435" x2="38" y2="440" />
        <line x1="90" y1="458" x2="94" y2="443" /><line x1="94" y1="443" x2="90" y2="448" /><line x1="94" y1="443" x2="98" y2="448" />
        <line x1="150" y1="452" x2="154" y2="437" /><line x1="154" y1="437" x2="150" y2="442" /><line x1="154" y1="437" x2="158" y2="442" />
        <line x1="210" y1="460" x2="214" y2="445" /><line x1="214" y1="445" x2="210" y2="450" /><line x1="214" y1="445" x2="218" y2="450" />
        <path d="M30 450 Q60 440 90 458 Q120 445 150 452 Q180 442 210 460" fill="none" strokeWidth="0.8" />
      </g>

      <g opacity="0.85">
        <rect x="248" y="300" width="7" height="105" fill="#161C0E" />
        <path d="M242 300 L251.5 278 L261 300 Z" fill="#161C0E" />
        <line x1="234" y1="320" x2="269" y2="320" stroke="#161C0E" strokeWidth="2.5" />
        <line x1="236" y1="345" x2="267" y2="345" stroke="#161C0E" strokeWidth="2.5" />
        <line x1="234" y1="320" x2="220" y2="405" stroke="#161C0E" strokeWidth="2" />
        <line x1="269" y1="320" x2="283" y2="405" stroke="#161C0E" strokeWidth="2" />
        <rect x="249" y="272" width="5" height="14" fill="#161C0E" />
        <circle cx="251.5" cy="270" r="2.2" fill="#FFD98A" />
      </g>

      <g fill="#161C0E" opacity="0.7">
        <rect x="60" y="490" width="26" height="12" rx="2" />
        <rect x="86" y="486" width="24" height="16" rx="2" />
        <rect x="110" y="492" width="20" height="10" rx="2" />
      </g>

      <g fill="#F0C878" opacity="0.35">
        <circle cx="40" cy="380" r="1" /><circle cx="120" cy="360" r="0.8" /><circle cx="200" cy="400" r="1.1" />
        <circle cx="260" cy="340" r="0.9" /><circle cx="90" cy="410" r="0.7" /><circle cx="280" cy="420" r="1" />
      </g>

      <rect x="0" y="0" width="320" height="600" fill="#1C2116" opacity="0.12" />
    </svg>
  )
}
