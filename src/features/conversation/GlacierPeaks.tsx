// The Arctic Survivalist's chat atmosphere: layered glacier peaks with
// atmospheric depth (hazy far ridge, crevassed mid slope, bright sun-lit
// foreground ice) plus a warm sun glow cutting against the cold blue sky
// and scattered snow glints. Deterministic, sits behind the messages in
// Conversation.tsx. The sky gradient itself lives in the theme's
// `background` (characterThemes.ts) -- this component only paints the
// peaks, sun, and snow on top of it.
export function GlacierPeaks() {
  return (
    <svg
      viewBox="0 0 276 588"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <radialGradient id="mindtipSunGlow" cx="72%" cy="46%" r="30%">
          <stop offset="0%" stopColor="#FFE8C2" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#FFD9A0" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFD9A0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mindtipFarPeak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6E93A8" />
          <stop offset="100%" stopColor="#527086" />
        </linearGradient>
        <linearGradient id="mindtipMidPeakLit" x1="0.2" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#DCEBF2" />
          <stop offset="55%" stopColor="#A8C4D2" />
          <stop offset="100%" stopColor="#6E93A8" />
        </linearGradient>
        <linearGradient id="mindtipMidPeakShadow" x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#3A5468" />
          <stop offset="100%" stopColor="#26394A" />
        </linearGradient>
        <linearGradient id="mindtipNearPeakLit" x1="0.1" y1="0" x2="1" y2="0.9">
          <stop offset="0%" stopColor="#F2FAFD" />
          <stop offset="40%" stopColor="#D2E6EE" />
          <stop offset="100%" stopColor="#8FB2C2" />
        </linearGradient>
        <linearGradient id="mindtipNearPeakShadow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22374A" />
          <stop offset="100%" stopColor="#141F2C" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="270" r="90" fill="url(#mindtipSunGlow)" />

      <path d="M0 260 L30 220 L55 245 L85 195 L115 230 L150 205 L180 235 L210 200 L240 228 L276 210 L276 588 L0 588 Z" fill="url(#mindtipFarPeak)" opacity="0.55" />

      <path d="M0 340 L45 260 L70 285 L100 225 L108 232 L96 260 L130 300 L160 250 L200 300 L225 260 L276 320 L276 588 L0 588 Z" fill="url(#mindtipMidPeakShadow)" />
      <path d="M45 260 L100 225 L96 260 L130 300 L108 232 Z" fill="url(#mindtipMidPeakLit)" />
      <path d="M160 250 L200 300 L225 260 L188 262 Z" fill="url(#mindtipMidPeakLit)" opacity="0.9" />
      <g stroke="#1C2E3E" strokeWidth="1" opacity="0.5">
        <path d="M60 270 L72 282 L66 290" fill="none" />
        <path d="M140 270 L152 280" fill="none" />
      </g>

      <path d="M0 460 L40 380 L75 410 L120 340 L112 350 L150 400 L145 385 L190 430 L230 370 L276 420 L276 588 L0 588 Z" fill="url(#mindtipNearPeakShadow)" />
      <path d="M40 380 L75 410 L120 340 L112 350 L92 385 Z" fill="url(#mindtipNearPeakLit)" />
      <path d="M150 400 L145 385 L190 430 L165 415 Z" fill="url(#mindtipNearPeakLit)" opacity="0.95" />
      <path d="M190 430 L230 370 L250 400 L212 408 Z" fill="url(#mindtipNearPeakLit)" opacity="0.85" />
      <g stroke="#16222E" strokeWidth="1.2" opacity="0.55" fill="none">
        <path d="M55 400 L68 412 L60 420 L74 428" />
        <path d="M160 405 L172 414" />
        <path d="M205 390 L216 400 L210 408" />
      </g>

      <g fill="#F2FAFD" opacity="0.7">
        <circle cx="34" cy="410" r="0.9" /><circle cx="88" cy="392" r="0.8" /><circle cx="142" cy="418" r="1" />
        <circle cx="200" cy="400" r="0.8" /><circle cx="240" cy="422" r="0.9" /><circle cx="20" cy="360" r="0.7" />
        <circle cx="110" cy="370" r="0.8" /><circle cx="180" cy="360" r="0.7" />
      </g>
    </svg>
  )
}
