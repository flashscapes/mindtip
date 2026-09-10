import type { ReflectionGenerator } from './ReflectionGenerator'
import { MockReflectionGenerator } from './MockReflectionGenerator'
import { RemoteReflectionGenerator } from './RemoteReflectionGenerator'

export type { ReflectionInput, ReflectionResult } from './ReflectionGenerator'

/** Same VITE_AI_PROVIDER toggle used by createAIProvider and createMemoryExtractor. */
export function createReflectionGenerator(): ReflectionGenerator {
  const provider = import.meta.env.VITE_AI_PROVIDER ?? 'mock'
  return provider === 'mock' ? new MockReflectionGenerator() : new RemoteReflectionGenerator()
}
