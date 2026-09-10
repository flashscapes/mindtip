import type { Memory, Message, UserProfile, Tip } from '@/types'

/**
 * Everything the AI needs to generate a personalized response.
 * Built explicitly by the caller each turn — see section 7/23 of the spec:
 * memory is never "magically" available, it's assembled and passed in.
 */
export interface AIContext {
  profile: UserProfile
  relevantMemories: Memory[]
  recentMessages: Message[]
  currentMessage: string
}

export interface AIResponse {
  replyText: string
  tip?: Tip
  /**
   * True when this turn's reply included enough substantive material to
   * offer the person a Reflection — never a claim that the model has
   * understood their psychology. See the system prompt's "reflectionReady"
   * guidance for the exact (deliberately simple) bar this must clear.
   */
  reflectionReady?: boolean
  /** TEMPORARY — raw model output, for diagnosing reflectionReady. */
  _rawDebug?: string
}

/**
 * Abstraction over whichever model/provider actually generates a response.
 * Swap MockAIProvider for a real Claude/OpenAI/Gemini-backed implementation
 * later without touching any UI or memory code.
 */
export interface AIProvider {
  generateResponse(context: AIContext): Promise<AIResponse>
}
