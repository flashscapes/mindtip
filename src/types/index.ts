// Core domain types for MindTip.
// Kept flat and small on purpose — see README for how this evolves toward
// a real database schema without breaking these shapes.

// What kind of perspective helps this person when they're stuck. Chosen on
// the welcome screen (one tap, four options) and injected into every
// conversation's prompt by server/prompts/buildContext.ts, where it shapes
// HOW the chosen character delivers -- never who the character is.
export type SupportStyle = 'analytical' | 'empathetic' | 'big_picture' | 'tactical'

export const SUPPORT_STYLES: SupportStyle[] = ['analytical', 'empathetic', 'big_picture', 'tactical']

/**
 * Profiles saved before the style question existed carry a supportStyle
 * from the old three-value set, which nothing understands any more. This
 * is how the app recognises one so it can ask the question rather than
 * silently running on a dead value.
 */
export function isSupportStyle(value: unknown): value is SupportStyle {
  return typeof value === 'string' && (SUPPORT_STYLES as string[]).includes(value)
}

export interface UserProfile {
  id: string
  preferredName?: string
  supportStyle: SupportStyle
  triggers: string[]
  whatHelps: string[]
  whatDoesntHelp: string[]
  /** Whether the user opted in to occasional proactive check-ins (section 9). */
  proactiveCheckIns: boolean
  onboardedAt: string
  /**
   * Persistent flag marking onboarding as finished. Checked on launch so the
   * onboarding flow is only ever shown once per user, on their first launch.
   */
  onboardingCompleted: boolean
}

/**
 * A distilled, structured unit of long-term memory.
 * Never raw conversation text — see MemoryService for how these are derived.
 */
export type MemoryType = 'pattern' | 'effective_strategy' | 'ineffective_strategy' | 'trigger' | 'situational_context'

export interface Memory {
  id: string
  type: MemoryType
  content: string
  confidence: number // 0-1
  source: 'onboarding' | 'conversation' | 'feedback'
  createdAt: string
  lastUsedAt?: string
  active: boolean
  /** Only set for 'situational_context' memories — once past, this memory is excluded from retrieval (see MemoryService.getAll). */
  expiresAt?: string
}

export type MessageRole = 'user' | 'assistant'

/** A persona the person can choose to talk this conversation through. */
export interface Character {
  key: string
  label: string
  personaPrompt: string
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  createdAt: string
  /** Present when this assistant message is a structured MindTip, not plain chat. */
  tip?: Tip
  /** True when a streamed reply was cut off partway through -- content holds
   *  whatever text arrived before the interruption. Rendered as a small,
   *  clearly-system notice separate from the message text itself, never
   *  appended into content, so a "cut off" note never reads as something
   *  the character actually said. */
  truncated?: boolean
}

export interface Tip {
  headline: string
  action: string
  /** If this tip was informed by a stored memory, a short human-readable reference to it. */
  referencedMemory?: string
}

export interface Conversation {
  id: string
  messages: Message[]
  startedAt: string
}

export type SafetyLevel = 'normal' | 'crisis'
