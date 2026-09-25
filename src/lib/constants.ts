export const STORAGE_KEYS = {
  profile: 'mindtip.profile',
  memories: 'mindtip.memories',
  conversation: 'mindtip.conversation',
  experimentCache: 'mindtip.experimentCache'
} as const

export const QUICK_ACTIONS = [
  { emoji: '😤', label: "I'm frustrated" },
  { emoji: '😰', label: "I'm stressed" },
  { emoji: '🧠', label: "I'm overthinking" },
  { emoji: '😴', label: "I'm drained" },
  { emoji: '🙂', label: "I'm doing pretty well" },
  { emoji: '✨', label: 'Just check in' }
] as const

export const TRIGGER_OPTIONS = [
  'Work', 'Family', 'Relationships', 'Uncertainty', 'Sunday evenings', 'Overthinking'
]

export const HELPS_OPTIONS = [
  'Walking', 'Talking to a friend', 'Music', 'Writing it down', 'Taking space', 'One small task'
]

export const UNHELPFUL_OPTIONS = [
  'Meditation', 'Breathing exercises', 'Long explanations',
  'Motivational quotes', 'Too many questions'
]

// The app's own speaking voice, used by the screens that come before any
// character has been chosen: the welcome questions and Home's greeting.
// Resolved in api/speak.ts. Kept here so the two screens cannot drift --
// Home previously passed no key at all and silently got the light default.
export const APP_VOICE_KEY = 'welcome'
