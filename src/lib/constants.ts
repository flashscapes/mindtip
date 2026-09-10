export const STORAGE_KEYS = {
  profile: 'mindtip.profile',
  memories: 'mindtip.memories',
  conversation: 'mindtip.conversation'
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
