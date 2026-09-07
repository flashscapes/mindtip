import type { MemoryExtractor } from './MemoryExtractor'
import { MockMemoryExtractor } from './MockMemoryExtractor'
import { RemoteMemoryExtractor } from './RemoteMemoryExtractor'

/**
 * Same VITE_AI_PROVIDER toggle used for response generation (see
 * src/services/ai/index.ts). 'mock' needs no server; anything else routes
 * to the server, which decides the real model on its own.
 */
export function createMemoryExtractor(): MemoryExtractor {
  const provider = import.meta.env.VITE_AI_PROVIDER ?? 'mock'
  return provider === 'mock' ? new MockMemoryExtractor() : new RemoteMemoryExtractor()
}
