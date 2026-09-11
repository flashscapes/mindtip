import type { ExperimentGenerator, ExperimentInput, ExperimentResult } from './ExperimentGenerator'

/** Deterministic stand-in for local dev — only "finds" an experiment if a pattern/trigger/situational_context memory exists, mirroring the real quality bar. */
export class MockExperimentGenerator implements ExperimentGenerator {
  async generate({ memories }: ExperimentInput): Promise<ExperimentResult> {
    const candidate = memories.find(m => m.type === 'pattern' || m.type === 'trigger' || m.type === 'situational_context')
    if (!candidate) return { experiment: null }
    return {
      experiment: `You mentioned ${candidate.content.toLowerCase()}. One thing you could experiment with today is noticing when that comes up, without needing to act on it right away.`
    }
  }
}
