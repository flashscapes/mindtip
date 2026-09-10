import type { AIContext, AIProvider, AIResponse } from './AIProvider'

/**
 * A deterministic stand-in for a real model call. Approximates the same
 * "understand before advising" contract given to the real model (see
 * server/prompts/system.ts): don't jump from an emotion to a coping
 * suggestion — validate, ask one exploratory question if needed, then
 * respond with a tip once there's enough to go on.
 *
 * Honest limitation: stages 4/5 of the real flow ("reflect the underlying
 * pattern", "decide what would actually help") require genuinely
 * understanding the user's situation. This class approximates the *shape*
 * of that (a reflective sentence, a situation-flavored tip) with keyword
 * matching — it cannot actually reason about what's going on. That's the
 * gap a real provider closes; see GeminiProvider.
 */
export class MockAIProvider implements AIProvider {
  async generateResponse(context: AIContext): Promise<AIResponse> {
    const { recentMessages, currentMessage } = context

    if (this.isJustCheckingIn(currentMessage)) {
      return { replyText: "Good to hear from you. What's on your mind, or just saying hi?" }
    }

    // Exception: an explicit request for something to do right now skips
    // exploration entirely, however little context there is.
    if (this.wantsImmediateHelp(currentMessage)) {
      return this.buildTipResponse(context)
    }

    // If the last thing MindTip said was exploring (no tip), the user is
    // now answering it — move to a tip even if the answer is still short.
    // Never ask a second exploratory question in a row.
    const lastAssistantMessage = [...recentMessages].reverse().find(m => m.role === 'assistant')
    const alreadyExplored = lastAssistantMessage !== undefined && !lastAssistantMessage.tip

    if (this.isVague(currentMessage) && !alreadyExplored) {
      return { replyText: this.pickExploratoryQuestion(currentMessage) }
    }

    return this.buildTipResponse(context)
  }

  private buildTipResponse(context: AIContext): AIResponse {
    const { profile, relevantMemories, recentMessages, currentMessage } = context
    const usedMemory = relevantMemories.find(m => m.type === 'effective_strategy')
    const matchedTrigger = profile.triggers.find(t => currentMessage.toLowerCase().includes(t.toLowerCase()))
    const fallbackAction = profile.whatHelps[0] ?? 'stepping away for a few minutes'

    const reflection = matchedTrigger
      ? `It sounds like this keeps coming back to ${matchedTrigger.toLowerCase()} — that's probably the real thread here, not just this one moment.`
      : this.pickValidation(currentMessage)

    const action = usedMemory
      ? `${usedMemory.content} Worth reaching for again next time this comes up.`
      : `Right now, try ${fallbackAction.toLowerCase()}. Going forward, it might help to notice ${
          matchedTrigger ? `when ${matchedTrigger.toLowerCase()} starts pulling you into this` : 'when this pattern starts'
        } before it builds up.`

    const headline = usedMemory ? "You've used this before." : "Here's what might actually help."

    // Mirrors the real prompt's deliberately simple bar: only once there's
    // been at least one prior exchange (not the very first message) and
    // there's something specific to reflect on (a matched trigger or reused
    // strategy) rather than a generic fallback.
    const reflectionReady = recentMessages.length >= 2 && (matchedTrigger !== undefined || usedMemory !== undefined)

    return {
      replyText: reflection,
      tip: {
        headline,
        action,
        referencedMemory: usedMemory ? usedMemory.content : undefined
      },
      reflectionReady
    }
  }

  private isJustCheckingIn(message: string): boolean {
    return message.trim().toLowerCase() === "i'm just checking in."
  }

  private wantsImmediateHelp(message: string): boolean {
    return /right now|immediately|just tell me|give me something/i.test(message)
  }

  private isVague(message: string): boolean {
    return message.trim().length < 30
  }

  private pickExploratoryQuestion(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('frustrat')) return "Yeah, let's unpack that. What happened?"
    if (lower.includes('stress')) return 'Stressful how — work, something at home, or just piling up?'
    if (lower.includes('overthink') || lower.includes('overwhelm')) return "What's the loop your brain's stuck on right now?"
    if (lower.includes('drain')) return "What's been draining you today?"
    if (lower.includes('angry') || lower.includes('mad') || lower.includes('pissed')) return "That's a lot. What set it off?"
    return "What's going on — what happened?"
  }

  private pickValidation(message: string): string {
    const lower = message.toLowerCase()
    if (lower.includes('angry') || lower.includes('pissed') || lower.includes('mad')) {
      return "Yeah, that would get under anyone's skin."
    }
    if (lower.includes('overwhelm') || lower.includes('too much')) {
      return 'Sounds like a lot is landing at once.'
    }
    if (lower.includes('anxious') || lower.includes('nervous') || lower.includes('worried')) {
      return 'That kind of uncertainty is uncomfortable to sit with.'
    }
    return 'Got it — that sounds like a real thing to be dealing with.'
  }
}
