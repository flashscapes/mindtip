import type { Message, UserProfile, MemoryType } from '../../../src/types'

export interface MemoryExtractionModelInput {
  messages: Message[]
  profile: UserProfile
}

export interface ExtractedMemory {
  type: MemoryType
  content: string
  confidence: number
}

export interface MemoryExtractionModelResult {
  memories: ExtractedMemory[]
}

/**
 * The seam between "extract memory" as a concept and whichever LLM
 * actually does it. The route only ever depends on this interface — see
 * ./index.ts for how the concrete model is chosen.
 */
export interface MemoryExtractionModel {
  extract(input: MemoryExtractionModelInput): Promise<MemoryExtractionModelResult>
}
