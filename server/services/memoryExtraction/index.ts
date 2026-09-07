import type { MemoryExtractionModel } from './types'
import { GeminiMemoryExtractionModel } from './geminiMemoryExtractionModel'

/**
 * Which model actually performs extraction is chosen here, via
 * MEMORY_EXTRACTION_PROVIDER (defaults to 'gemini'). Adding OpenAI or
 * Claude later means writing one new class implementing
 * MemoryExtractionModel and adding one case below — the route, and every
 * client-side caller, stay exactly as they are.
 */
export function createMemoryExtractionModel(): MemoryExtractionModel {
  const provider = process.env.MEMORY_EXTRACTION_PROVIDER ?? 'gemini'
  switch (provider) {
    case 'gemini':
    default:
      return new GeminiMemoryExtractionModel()
  }
}
