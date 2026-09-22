// Per-character chat theming. Deliberately separate from the Character type
// used in AIContext — the model never sees any of this, it's purely visual.
// Keyed by the same character `key` used on Home. Only noir-detective has a
// full environment (background + atmosphere + icon + real message bubbles)
// so far, proven out as the first real theme before extending the same
// pattern to the rest; everyone else gets their assigned font only for now.
export interface BubbleTheme {
  assistantBg: string
  assistantText: string
  userBg: string
  userText: string
  timestampColor: string
  // 'ice' clips the bubble into a jagged, icicle-fringed silhouette;
  // 'hud' gives it a sharp bordered panel with small corner brackets,
  // like a heads-up-display readout. See ChatBubble.tsx.
  shape?: 'ice' | 'hud'
  // The little fedora glyph next to assistant messages was previously
  // unconditional whenever bubbles was set at all, showing up incongruously
  // next to survivalist/astronaut/executive messages too -- noir-detective
  // is the only character it was actually designed for.
  icon?: 'fedora'
  assistantBorder?: string
  userBorder?: string
  // Only used by the plain rounded-rect shape (shape unset) -- lets a
  // theme use sharper corners than the 16px/4px default without needing
  // a whole new shape variant. Undefined keeps the existing look exactly.
  borderRadius?: number
  tailRadius?: number
}

// For themes that render as plain text rather than bubbles (see the
// Historian below) but still want the two speakers visually distinct --
// two different "ink" colors instead of one text color plus opacity.
export interface InkColors {
  assistant: string
  user: string
}

export interface CharacterTheme {
  font: string
  fontWeight?: number | string
  background?: string
  textColor?: string
  placeholderColor?: string
  accentColor?: string
  atmosphere?: 'noir' | 'arctic' | 'orbit'
  bubbles?: BubbleTheme
  inkColors?: InkColors
  lineHeight?: number
}

export const CHARACTER_THEMES: Record<string, CharacterTheme> = {
  'noir-detective': {
    font: "'Special Elite', monospace",
    background: 'linear-gradient(160deg, #1a1a1a, #0f0f0f)',
    textColor: '#E8DFC8',
    placeholderColor: 'rgba(232,223,200,0.4)',
    accentColor: '#c9a227',
    atmosphere: 'noir',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, #2A2420, #1C1815)',
      assistantText: '#E8DFC8',
      userBg: 'linear-gradient(160deg, #6B4F22, #4A3618)',
      userText: '#F5E8C8',
      timestampColor: 'rgba(201,162,39,0.65)',
      icon: 'fedora'
    }
  },
  // Deliberately the plainest theme in the app -- no atmosphere, no
  // bubbles, no display font. The Therapist is meant to be the grounded,
  // non-theatrical counterpoint to the other characters (see Home.tsx's
  // persona), so he gets the app's own default UI font (Inter) rather
  // than a character-y display font, and a calm, muted backdrop instead
  // of a staged scene. Reuses Batman's former ring position and blue
  // accent, which already reads as calm/professional in this context --
  // the "Batman-ness" was the Gotham atmosphere and persona, not the color.
  // Real photo background (same pattern as poker below) plus premium
  // bubbles -- warm charcoal/espresso for him, warm amber-cream for the
  // user, echoing the lamp's own warm light rather than a cool/clinical
  // palette, matching the calm-but-warm persona.
  therapist: {
    font: "'Inter', sans-serif",
    background:
      'linear-gradient(180deg, rgba(10,8,6,0.5) 0%, rgba(10,8,6,0.2) 30%, rgba(10,8,6,0.35) 70%, rgba(10,8,6,0.8) 100%), ' +
      "url('/images/therapist-bg.jpg') center 35% / cover no-repeat",
    textColor: '#EDE3D0',
    placeholderColor: 'rgba(237,227,208,0.4)',
    accentColor: '#D9B67A',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, rgba(42,34,28,0.9), rgba(20,16,13,0.94))',
      assistantText: '#EDE3D0',
      assistantBorder: 'rgba(217,182,122,0.6)',
      userBg: 'linear-gradient(160deg, #E8C896, #C9A05C)',
      userText: '#2A1E10',
      userBorder: 'rgba(217,182,122,0.85)',
      timestampColor: '#D9B67A'
    }
  },
  // Uses a real photo (not an illustrated atmosphere component like the
  // other characters) -- the room itself IS the visual, no staged SVG scene
  // needed on top of it. A dark scrim gradient sits between the photo and
  // the text layer for legibility, stacked as an earlier layer in the same
  // background shorthand rather than a separate element.
  poker: {
    font: "'Inter', sans-serif",
    background:
      'linear-gradient(180deg, rgba(5,5,10,0.55) 0%, rgba(5,5,10,0.25) 30%, rgba(5,5,10,0.35) 70%, rgba(5,5,10,0.75) 100%), ' +
      "url('/images/poker-room-bg.jpg') center 30% / cover no-repeat",
    textColor: '#F0E8D0',
    placeholderColor: 'rgba(240,232,208,0.4)',
    accentColor: '#E8C878',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, rgba(30,52,40,0.88), rgba(13,31,23,0.92))',
      assistantText: '#F0E8D0',
      assistantBorder: 'rgba(232,200,120,0.7)',
      userBg: 'linear-gradient(160deg, #E8C878, #B8903E)',
      userText: '#1A1408',
      userBorder: 'rgba(232,200,120,0.9)',
      timestampColor: '#E8C878'
    }
  },
  executive: {
    // Inter is already loaded for the app's own UI, so this adds no new
    // font request — and a clean modern sans is the right register here
    // anyway. Tight corner radii read as precise/corporate rather than
    // casual, without needing a custom bubble shape.
    font: "'Inter', sans-serif",
    fontWeight: 500,
    // Night financial-district skyline. The source photo is small, so it is
    // pre-cropped to portrait and very slightly blurred in the asset itself
    // rather than left to the browser to enlarge raw -- at phone size it
    // reads as depth of field instead of a stretched low-res image. Scrim
    // opacities here match the ones the asset was checked against.
    background:
      'linear-gradient(180deg, rgba(8,14,26,0.62) 0%, rgba(8,14,26,0.42) 30%, rgba(8,14,26,0.50) 70%, rgba(8,14,26,0.80) 100%), ' +
      "url('/images/executive-bg.jpg') center 40% / cover no-repeat",
    textColor: '#E6ECF4',
    placeholderColor: 'rgba(230,236,244,0.4)',
    accentColor: '#B8C4D4',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, rgba(38,56,86,0.92), rgba(20,32,52,0.95))',
      assistantText: '#E6ECF4',
      assistantBorder: 'rgba(184,196,212,0.35)',
      userBg: 'linear-gradient(160deg, #B8C4D4, #8494A8)',
      userText: '#0E1622',
      timestampColor: 'rgba(184,196,212,0.75)',
      borderRadius: 6,
      tailRadius: 2
    }
  },
  survivalist: {
    font: "'Oswald', sans-serif",
    background:
      'radial-gradient(circle at 72% 32%, rgba(255,216,160,0.18), transparent 30%), ' +
      'linear-gradient(180deg, #0B1826 0%, #16324A 35%, #3E6B85 62%, #7FA8B8 100%)',
    textColor: '#F5FAFD',
    placeholderColor: 'rgba(245,250,253,0.4)',
    accentColor: '#A8CBDC',
    atmosphere: 'arctic',
    bubbles: {
      assistantBg: 'rgba(255,255,255,0.16)',
      assistantText: '#F5FAFD',
      userBg: 'rgba(255,255,255,0.28)',
      userText: '#0F2433',
      timestampColor: 'rgba(168,203,220,0.85)',
      shape: 'ice'
    }
  },
  astronaut: {
    font: "'Exo 2', sans-serif",
    background:
      'radial-gradient(ellipse at 28% 22%, rgba(61,42,107,0.5), transparent 55%), ' +
      'radial-gradient(ellipse at 85% 30%, rgba(31,107,117,0.3), transparent 35%), #02030A',
    textColor: '#CFF5F8',
    placeholderColor: 'rgba(207,245,248,0.4)',
    accentColor: '#6DD8E0',
    atmosphere: 'orbit',
    bubbles: {
      assistantBg: 'rgba(10,30,40,0.55)',
      assistantText: '#CFF5F8',
      userBg: 'rgba(109,216,224,0.16)',
      userText: '#EAFBFC',
      timestampColor: 'rgba(109,216,224,0.7)',
      assistantBorder: 'rgba(109,216,224,0.55)',
      userBorder: 'rgba(109,216,224,0.4)',
      shape: 'hud'
    }
  }
}
