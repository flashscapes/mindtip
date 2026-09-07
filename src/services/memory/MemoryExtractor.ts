import type { Message, MemoryType, UserProfile } from '@/types'

export interface MemoryExtractionInput {
  messages: Message[]
  profile: UserProfile
}

export interface ExtractedMemory {
  type: MemoryType
  content: string
  confidence: number
}

export interface MemoryExtractionResult {
  memories: ExtractedMemory[]
}

/**
 * Provider-agnostic memory extraction, mirroring AIProvider. Conversation.tsx
 * and MemoryService only ever depend on this interface — never on Gemini,
 * OpenAI, or any other model by name. Swapping the underlying model later
 * means writing one new implementation of this interface (or, since the
 * real work happens server-side, one new MemoryExtractionModel — see
 * server/services/memoryExtraction) and nothing here has to change.
 */
export interface MemoryExtractor {
  extract(input: MemoryExtractionInput): Promise<MemoryExtractionResult>
}
