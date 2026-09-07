import { GoogleGenerativeAI } from '@google/generative-ai'
import { MEMORY_EXTRACTION_SYSTEM_PROMPT } from '../../prompts/memoryExtraction.js'
import type { MemoryExtractionModel, MemoryExtractionModelInput, MemoryExtractionModelResult } from './types.js'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set — memory extraction calls will fail until it is added to .env')
}

const genAI = new GoogleGenerativeAI(apiKey ?? '')

export class GeminiMemoryExtractionModel implements MemoryExtractionModel {
  async extract({ messages, profile }: MemoryExtractionModelInput): Promise<MemoryExtractionModelResult> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const transcript = messages.map(m => `${m.role === 'user' ? 'User' : 'MindTip'}: ${m.content}`).join('\n')
    const profileSummary = [
      `Known triggers: ${profile.triggers.join(', ') || 'none'}`,
      `Known effective strategies: ${profile.whatHelps.join(', ') || 'none'}`,
      `Known ineffective strategies: ${profile.whatDoesntHelp.join(', ') || 'none'}`
    ].join('\n')

    const prompt = [
      MEMORY_EXTRACTION_SYSTEM_PROMPT,
      'EXISTING PROFILE',
      profileSummary,
      '',
      'CONVERSATION',
      transcript
    ].join('\n\n')

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const cleaned = raw.replace(/^```json\s*|```$/g, '').trim()

    const parsed = JSON.parse(cleaned) as MemoryExtractionModelResult
    return { memories: Array.isArray(parsed.memories) ? parsed.memories : [] }
  }
}
