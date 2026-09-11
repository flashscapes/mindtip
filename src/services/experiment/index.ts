import type { ExperimentGenerator } from './ExperimentGenerator'
import { MockExperimentGenerator } from './MockExperimentGenerator'
import { RemoteExperimentGenerator } from './RemoteExperimentGenerator'

export type { ExperimentInput, ExperimentResult } from './ExperimentGenerator'

/** Same VITE_AI_PROVIDER toggle used by createAIProvider, createMemoryExtractor, and createReflectionGenerator. */
export function createExperimentGenerator(): ExperimentGenerator {
  const provider = import.meta.env.VITE_AI_PROVIDER ?? 'mock'
  return provider === 'mock' ? new MockExperimentGenerator() : new RemoteExperimentGenerator()
}
