// The Astronaut's chat atmosphere: deep space with a soft nebula wash,
// scattered stars, and a real dimensional planet -- directional
// sunlit-to-shadow shading, soft blurred landmasses, wispy cloud cover, a
// day/night terminator, and a bright atmospheric rim glow along the limb --
// rather than a flat glowing disc. Ported directly from the approved
// mockup art. Sits behind the messages in Conversation.tsx; the base
// sky/nebula wash itself lives in the theme's `background`
// (characterThemes.ts) -- this component paints the stars and the planet.
export function AstronautOrbit() {
  return (
    <svg
      viewBox="0 0 276 588"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 w-full h-full pointer-events-none"
    >
      <defs>
        <filter id="mindtipSoftBlur"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id="mindtipCloudBlur"><feGaussianBlur stdDeviation="2.5" /></filter>
        <radialGradient id="mindtipPlanetBase" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#7FC4D8" />
          <stop offset="35%" stopColor="#3D8CAE" />
          <stop offset="65%" stopColor="#1F5478" />
          <stop offset="100%" stopColor="#0A1E30" />
        </radialGradient>
        <linearGradient id="mindtipTerminator" x1="0.1" y1="0.1" x2="0.85" y2="0.75">
          <stop offset="0%" stopColor="#000814" stopOpacity="0" />
          <stop offset="60%" stopColor="#000814" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#000814" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id="mindtipAtmoRim" cx="38%" cy="30%" r="52%">
          <stop offset="92%" stopColor="#8FE8F0" stopOpacity="0" />
          <stop offset="99%" stopColor="#BFF5FA" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#BFF5FA" stopOpacity="0" />
        </radialGradient>
        <clipPath id="mindtipPlanetClip"><ellipse cx="138" cy="700" rx="215" ry="215" /></clipPath>
      </defs>

      <g fill="#FFFFFF">
        <circle cx="30" cy="60" r="1" /><circle cx="80" cy="40" r="0.7" /><circle cx="140" cy="80" r="1.3" />
        <circle cx="200" cy="50" r="0.8" /><circle cx="240" cy="90" r="1" /><circle cx="60" cy="130" r="0.7" />
        <circle cx="180" cy="140" r="1.1" /><circle cx="20" cy="180" r="0.8" /><circle cx="250" cy="160" r="0.7" />
        <circle cx="110" cy="30" r="0.9" /><circle cx="160" cy="110" r="0.6" /><circle cx="90" cy="200" r="0.9" />
        <circle cx="230" cy="220" r="0.7" /><circle cx="15" cy="240" r="0.6" />
      </g>
      <circle cx="140" cy="80" r="2.2" fill="#CFE8FF" opacity="0.9" />

      <g clipPath="url(#mindtipPlanetClip)">
        <ellipse cx="138" cy="700" rx="215" ry="215" fill="url(#mindtipPlanetBase)" />
        <g filter="url(#mindtipSoftBlur)" opacity="0.75">
          <ellipse cx="70" cy="560" rx="38" ry="24" fill="#4A7A4A" />
          <ellipse cx="130" cy="600" rx="55" ry="20" fill="#5C8A52" />
          <ellipse cx="220" cy="580" rx="30" ry="34" fill="#3E6B48" />
          <ellipse cx="90" cy="630" rx="20" ry="14" fill="#6B8A4A" />
        </g>
        <g filter="url(#mindtipCloudBlur)" opacity="0.55" fill="#F5FBFF">
          <ellipse cx="100" cy="545" rx="34" ry="7" />
          <ellipse cx="175" cy="565" rx="46" ry="8" />
          <ellipse cx="60" cy="590" rx="26" ry="6" />
          <ellipse cx="210" cy="610" rx="30" ry="7" />
          <ellipse cx="140" cy="620" rx="20" ry="5" />
        </g>
        <rect x="0" y="0" width="276" height="588" fill="url(#mindtipTerminator)" />
      </g>
      <ellipse cx="138" cy="700" rx="215" ry="215" fill="url(#mindtipAtmoRim)" />
    </svg>
  )
}
