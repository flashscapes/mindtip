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
}

export interface CharacterTheme {
  font: string
  background?: string
  textColor?: string
  accentColor?: string
  atmosphere?: 'noir'
  bubbles?: BubbleTheme
}

export const CHARACTER_THEMES: Record<string, CharacterTheme> = {
  'noir-detective': {
    font: "'Special Elite', monospace",
    background: 'linear-gradient(160deg, #1a1a1a, #0f0f0f)',
    textColor: '#E8DFC8',
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
  comedian: { font: "'Permanent Marker', cursive" },
  historian: { font: "'EB Garamond', serif" },
  survivalist: { font: "'Oswald', sans-serif" },
  batman: { font: "'Cinzel', serif" },
  astronaut: { font: "'Orbitron', sans-serif" }
}
