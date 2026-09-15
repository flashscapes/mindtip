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
  assistantBorder?: string
  userBorder?: string
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
  background?: string
  textColor?: string
  placeholderColor?: string
  accentColor?: string
  atmosphere?: 'noir' | 'gotham' | 'study' | 'arctic' | 'camp' | 'orbit'
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
      timestampColor: 'rgba(201,162,39,0.65)'
    }
  },
  batman: {
    font: "'Cinzel', serif",
    background: 'linear-gradient(180deg, #050810 0%, #0A1220 45%, #0D1830 100%)',
    textColor: '#C8DCF5',
    placeholderColor: 'rgba(200,220,245,0.4)',
    accentColor: '#D4AF37',
    atmosphere: 'gotham',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, #1A2B4D, #0D1830)',
      assistantText: '#C8DCF5',
      userBg: 'linear-gradient(160deg, #4A7FE0, #2A4A8A)',
      userText: '#EAF2FF',
      timestampColor: 'rgba(212,175,55,0.75)'
    }
  },
  historian: {
    font: "'EB Garamond', serif",
    background:
      'repeating-linear-gradient(95deg, rgba(0,0,0,0.09) 0px, rgba(0,0,0,0.09) 1px, transparent 1px, transparent 8px), ' +
      'repeating-linear-gradient(95deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 2px, transparent 2px, transparent 21px), ' +
      'radial-gradient(ellipse at 28% 15%, rgba(255,255,255,0.07), transparent 55%), ' +
      'linear-gradient(160deg, #6B4226 0%, #4A2C17 55%, #3A2110 100%)',
    textColor: '#3A2E14',
    placeholderColor: 'rgba(58,46,20,0.4)',
    accentColor: '#9C7A2E',
    atmosphere: 'study',
    inkColors: { assistant: '#3A2E14', user: '#1E3A6E' },
    lineHeight: 28
  },
  infantry: {
    font: "'Black Ops One', sans-serif",
    background:
      'radial-gradient(ellipse at 60% 20%, rgba(255,200,120,0.14), transparent 45%), ' +
      'linear-gradient(180deg, #2E3524 0%, #4A5638 45%, #6B7350 75%, #8A8560 100%)',
    textColor: '#E8E4D0',
    placeholderColor: 'rgba(232,228,208,0.4)',
    accentColor: '#B8C89A',
    atmosphere: 'camp',
    bubbles: {
      assistantBg: 'linear-gradient(160deg, #4A5638, #2E3524)',
      assistantText: '#E8E4D0',
      userBg: 'linear-gradient(160deg, #8A9A6E, #5C6B44)',
      userText: '#F5F5E8',
      timestampColor: 'rgba(184,200,154,0.75)'
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
    font: "'Orbitron', sans-serif",
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
