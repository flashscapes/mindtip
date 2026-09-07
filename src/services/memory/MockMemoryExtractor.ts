import type { MemoryExtractionInput, MemoryExtractionResult, MemoryExtractor } from './MemoryExtractor'

/**
 * A lightweight stand-in for a real extraction call, used in mock mode so
 * the full memory loop is demoable with no server and no API key. This is
 * the old keyword-matching heuristic, now honestly scoped to mock mode
 * only — the real path (RemoteMemoryExtractor) lets an actual model decide.
 */
export class MockMemoryExtractor implements MemoryExtractor {
  async extract({ messages, profile }: MemoryExtractionInput): Promise<MemoryExtractionResult> {
    const lastTipMessage = [...messages].reverse().find(m => m.role === 'assistant' && m.tip)
    if (!lastTipMessage?.tip) {
      return { memories: [] }
    }

    const matchesKnownHelp = profile.whatHelps.some(h => lastTipMessage.tip!.action.toLowerCase().includes(h.toLowerCase()))
    if (!matchesKnownHelp) {
      return { memories: [] }
    }

    return {
      memories: [{ type: 'effective_strategy', content: lastTipMessage.tip.action, confidence: 0.6 }]
    }
  }
}
