// The Frontline Infantry Man's chat atmosphere: a dusty olive-drab horizon
// at dusk, a distant ridge line, and a watchtower/radio-antenna silhouette
// with a warm haze glow low in the sky (dust and fading light, not smoke
// from anything specific) -- kept deliberately non-graphic, evoking the
// discipline and steadiness of the role rather than combat imagery.
export function InfantryCamp() {
  return (
    <svg
      viewBox="0 0 320 600"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <radialGradient id="mindtipDustGlow" cx="65%" cy="55%" r="40%">
          <stop offset="0%" stopColor="#F0C878" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F0C878" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mindtipRidgeFar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7350" />
          <stop offset="100%" stopColor="#4A5638" />
        </linearGradient>
        <linearGradient id="mindtipRidgeNear" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3E4A2E" />
          <stop offset="100%" stopColor="#2A3320" />
        </linearGradient>
      </defs>

      <ellipse cx="208" cy="360" rx="160" ry="110" fill="url(#mindtipDustGlow)" />

      <path d="M0 400 L40 370 L80 385 L130 355 L180 378 L230 360 L276 382 L320 365 L320 600 L0 600 Z" fill="url(#mindtipRidgeFar)" opacity="0.75" />
      <path d="M0 460 L50 420 L100 440 L150 405 L200 435 L250 415 L320 445 L320 600 L0 600 Z" fill="url(#mindtipRidgeNear)" />

      <rect x="248" y="330" width="6" height="90" fill="#1E2418" />
      <path d="M244 330 L251 315 L258 330 Z" fill="#1E2418" />
      <line x1="238" y1="345" x2="264" y2="345" stroke="#1E2418" strokeWidth="2" />
      <line x1="240" y1="365" x2="262" y2="365" stroke="#1E2418" strokeWidth="2" />
      <circle cx="251" cy="312" r="2" fill="#F0C878" opacity="0.7" />

      <g fill="#1E2418" opacity="0.9">
        <circle cx="60" cy="440" r="3" /><circle cx="90" cy="435" r="2.5" />
        <circle cx="200" cy="428" r="3" /><circle cx="230" cy="422" r="2.5" />
      </g>
    </svg>
  )
}
