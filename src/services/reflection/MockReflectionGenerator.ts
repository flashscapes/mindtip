import type { ReflectionGenerator, ReflectionInput, ReflectionResult } from './ReflectionGenerator'

/** Deterministic stand-in for local dev — approximates the shape, not the insight. */
export class MockReflectionGenerator implements ReflectionGenerator {
  async generate({ messages }: ReflectionInput): Promise<ReflectionResult> {
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content ?? 'what came up today'

    return {
      reflection: `It may not be the specific thing you described that's weighing on you most — it might be what it seems to say about a pattern you're tired of repeating.`,
      patterns: `This connects to a few things you've mentioned before around "${lastUserMessage.slice(0, 40)}".`,
      anchoring: 'Right now, take one slow breath and notice one thing in the room that is simply fine as it is.',
      insights: 'Nothing else distinct stood out in this conversation.'
    }
  }
}
