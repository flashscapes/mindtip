import type { Character, Memory, Message, UserProfile, Tip } from '@/types'

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
  /** Set for the whole conversation once a character is chosen on Home — see buildContext.ts for how this gets woven into the prompt. */
  character?: Character
}

export interface AIResponse {
  replyText: string
  tip?: Tip
}

/**
 * Abstraction over whichever model/provider actually generates a response.
 * Swap MockAIProvider for a real Claude/OpenAI/Gemini-backed implementation
 * later without touching any UI or memory code.
 */
export interface AIProvider {
  generateResponse(context: AIContext): Promise<AIResponse>
}
