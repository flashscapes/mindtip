// Batman's chat atmosphere: a cold, dark skyline with a faint bat-signal
// beam and a glowing cape silhouette catching it, sitting behind the fog
// layer in Conversation.tsx. Deterministic (no runtime randomness), and
// spans the full screen height (not just a bottom strip like the noir
// detective's skyline) so the beam has room to rise into the sky.
export function GothamSkyline() {
  return (
    <svg
      viewBox="0 0 320 600"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <radialGradient id="mindtipBeamGlow" cx="50%" cy="100%" r="75%">
          <stop offset="0%" stopColor="#DCE9FF" stopOpacity="0.35" />
          <stop offset="60%" stopColor="#8FB4F0" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#8FB4F0" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="160" cy="560" rx="220" ry="140" fill="url(#mindtipBeamGlow)" />
      <path d="M120 560 L160 260 L200 560 Z" fill="#DCE9FF" opacity="0.06" />
      <g opacity="0.9">
        <path d="M140 300 q20 -18 40 0 l-6 14 q-14 -8 -28 0 Z" fill="#0D1830" />
        <ellipse cx="160" cy="296" rx="3" ry="2" fill="#DCE9FF" opacity="0.5" />
      </g>

      <rect x="0" y="470" width="42" height="130" fill="#040609" />
      <path d="M42 470 L58 430 L74 470 Z" fill="#040609" />
      <rect x="74" y="470" width="34" height="130" fill="#060910" />
      <rect x="108" y="440" width="30" height="160" fill="#040609" />
      <path d="M138 440 L153 400 L168 440 Z" fill="#040609" />
      <rect x="168" y="440" width="36" height="160" fill="#060910" />
      <rect x="204" y="480" width="30" height="120" fill="#040609" />
      <rect x="234" y="450" width="34" height="150" fill="#060910" />
      <path d="M268 450 L284 410 L300 450 Z" fill="#040609" />
      <rect x="300" y="450" width="20" height="150" fill="#040609" />

      <rect x="14" y="500" width="4" height="6" fill="#8FB4F0" opacity="0.5" />
      <rect x="26" y="520" width="4" height="6" fill="#8FB4F0" opacity="0.3" />
      <rect x="84" y="500" width="4" height="6" fill="#8FB4F0" opacity="0.4" />
      <rect x="118" y="470" width="4" height="6" fill="#8FB4F0" opacity="0.5" />
      <rect x="128" y="500" width="4" height="6" fill="#8FB4F0" opacity="0.3" />
      <rect x="178" y="470" width="4" height="6" fill="#8FB4F0" opacity="0.45" />
      <rect x="190" y="510" width="4" height="6" fill="#8FB4F0" opacity="0.35" />
      <rect x="214" y="510" width="4" height="6" fill="#8FB4F0" opacity="0.4" />
      <rect x="244" y="480" width="4" height="6" fill="#8FB4F0" opacity="0.5" />
      <rect x="308" y="480" width="4" height="6" fill="#8FB4F0" opacity="0.4" />
    </svg>
  )
}
