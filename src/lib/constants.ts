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
  'Work', 'Money', 'Relationships', 'Family', 'Social situations',
  'Uncertainty', 'Sunday evenings', 'Mornings', 'Overthinking',
  'Loneliness', 'Feeling overwhelmed'
]

export const HELPS_OPTIONS = [
  'Walking', 'Exercise', 'Talking to a friend', 'Getting outside',
  'Taking space', 'Music', 'Writing it down', 'Changing environment',
  'Getting perspective', 'One small task', 'Sleep/rest'
]

export const UNHELPFUL_OPTIONS = [
  'Meditation', 'Breathing exercises', 'Long explanations',
  'Motivational quotes', 'Being told to "just relax"', 'Too many questions'
]
