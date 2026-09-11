import type { ExperimentGenerator, ExperimentInput, ExperimentResult } from './ExperimentGenerator'

/** Same VITE_API_BASE_URL pattern as GeminiProvider, RemoteMemoryExtractor, and RemoteReflectionGenerator. */
export class RemoteExperimentGenerator implements ExperimentGenerator {
  async generate(input: ExperimentInput): Promise<ExperimentResult> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    try {
      const res = await fetch(`${apiBaseUrl}/api/experiment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!res.ok) return { experiment: null }
      return (await res.json()) as ExperimentResult
    } catch (err) {
      // This is a quiet, optional enrichment — never let a network hiccup
      // surface anywhere in the UI. Silence is always an acceptable outcome.
      console.error('Experiment generation failed:', err)
      return { experiment: null }
    }
  }
}
