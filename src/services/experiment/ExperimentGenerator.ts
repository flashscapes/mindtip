import type { Memory, UserProfile } from '@/types'

export interface ExperimentInput {
  memories: Memory[]
  profile: UserProfile
}

export interface ExperimentResult {
  experiment: string | null
}

export interface ExperimentGenerator {
  generate(input: ExperimentInput): Promise<ExperimentResult>
}
