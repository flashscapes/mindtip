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
 * Thrown by a provider's generateResponse when a streamed reply fails
 * partway through, so the caller can tell "nothing came back at all" (a
 * plain Error) apart from "some of it streamed in before it broke" (this,
 * carrying whatever text already arrived so the caller can decide whether
 * to keep it rather than discarding visible content).
 */
export class StreamingResponseError extends Error {
  partialText?: string
  constructor(message: string, partialText?: string) {
    super(message)
    this.name = 'StreamingResponseError'
    this.partialText = partialText
  }
}

/**
 * Abstraction over whichever model/provider actually generates a response.
 * Swap MockAIProvider for a real Claude/OpenAI/Gemini-backed implementation
 * later without touching any UI or memory code.
 *
 * onChunk is optional and purely additive: a provider that streams (see
 * GeminiProvider's character-conversation path) calls it with the
 * progressively-assembled text as it arrives, so the UI can update in real
 * time; a provider that doesn't stream can ignore it entirely. Either way,
 * the returned Promise always resolves with the complete, final AIResponse
 * — callers that only care about the final result don't need to change.
 */
export interface AIProvider {
  generateResponse(context: AIContext, onChunk?: (textSoFar: string) => void): Promise<AIResponse>
}
