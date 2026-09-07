import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIContext, AIResponse } from '../../src/services/ai/AIProvider'
import { MINDTIP_SYSTEM_PROMPT } from '../prompts/system'
import { buildUserContextBlock } from '../prompts/buildContext'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set — Gemini calls will fail until it is added to .env')
}

const genAI = new GoogleGenerativeAI(apiKey ?? '')

// Ask Gemini to return strict JSON matching AIResponse, so the route can
// map it directly onto the shape the rest of the app already expects —
// no text parsing, no prompt-to-UI translation layer.
const RESPONSE_FORMAT_INSTRUCTIONS = `
Respond with ONLY a JSON object, no markdown fencing, no commentary, in exactly this shape:
{
  "replyText": string,
  "tip": {
    "headline": string,
    "action": string,
    "referencedMemory": string | null
  }
}`

export async function generateWithGemini(context: AIContext): Promise<AIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = [
    MINDTIP_SYSTEM_PROMPT,
    RESPONSE_FORMAT_INSTRUCTIONS,
    buildUserContextBlock(context),
    `CURRENT MESSAGE\n${context.currentMessage}`
  ].join('\n\n')

  const result = await model.generateContent(prompt)
  const raw = result.response.text().trim()
  const cleaned = raw.replace(/^```json\s*|```$/g, '').trim()

  const parsed = JSON.parse(cleaned) as {
    replyText: string
    tip?: { headline: string; action: string; referencedMemory?: string | null }
  }

  return {
    replyText: parsed.replyText,
    tip: parsed.tip
      ? {
          headline: parsed.tip.headline,
          action: parsed.tip.action,
          referencedMemory: parsed.tip.referencedMemory ?? undefined
        }
      : undefined
  }
}
