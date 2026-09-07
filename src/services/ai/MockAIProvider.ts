import type { AIContext, AIProvider, AIResponse } from './AIProvider'

/**
 * A deterministic stand-in for a real model call, so the full product loop
 * (profile -> memory -> response -> new memory) is demoable and testable
 * without any API keys. Replace with a real provider behind the same
 * AIProvider interface — nothing else in the app needs to change.
 */
export class MockAIProvider implements AIProvider {
  async generateResponse(context: AIContext): Promise<AIResponse> {
    const { profile, relevantMemories, currentMessage } = context

    const validation = this.pickValidation(currentMessage)
    const usedMemory = relevantMemories.find(m => m.type === 'effective_strategy')
    const fallbackAction = profile.whatHelps[0] ?? 'stepping away for a few minutes'

    const action = usedMemory
      ? usedMemory.content
      : `Try ${fallbackAction.toLowerCase()} before you decide what to do next.`

    const headline = usedMemory ? "You've used this before." : 'Take the edge off.'

    return {
      replyText: validation,
      tip: {
        headline,
        action,
        referencedMemory: usedMemory ? usedMemory.content : undefined
      }
    }
  }

  private pickValidation(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('angry') || lower.includes('pissed') || lower.includes('mad')) {
      return "Yeah, that would get under anyone's skin."
    }
    if (lower.includes('overwhelm') || lower.includes('too much')) {
      return "Sounds like a lot is landing at once."
    }
    if (lower.includes('anxious') || lower.includes('nervous') || lower.includes('worried')) {
      return "That kind of uncertainty is uncomfortable to sit with."
    }
    return "Got it — that sounds like a real thing to be dealing with."
  }
}
