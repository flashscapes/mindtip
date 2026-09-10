import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIContext, AIResponse } from '../../src/services/ai/AIProvider.js'
import { MINDTIP_SYSTEM_PROMPT } from '../prompts/system.js'
import { buildUserContextBlock } from '../prompts/buildContext.js'

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
  "tip": { "headline": string, "action": string, "referencedMemory": string | null } | null,
  "reflectionReady": boolean
}
Set "tip" to null on any turn that is validating and/or exploring rather than advising — see your instructions on when to move from exploration to insight to action.

Set "reflectionReady" to true only when ALL of these are true right now:
- the conversation has had at least a couple of substantive exchanges (not the very first message)
- the person's most recent message reads as a natural pause, not something demanding an immediate follow-up question
- there is enough specific material from THIS conversation to say something concrete and personal — not generic advice that would fit anyone
Otherwise set it to false. This is a simple bar about accumulated material, not a claim that you have understood the person's psychology or that they have "achieved insight" — when in doubt, set it to false and keep exploring.`

export async function generateWithGemini(context: AIContext): Promise<AIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

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
    reflectionReady?: boolean
  }

  return {
    replyText: parsed.replyText,
    tip: parsed.tip
      ? {
          headline: parsed.tip.headline,
          action: parsed.tip.action,
          referencedMemory: parsed.tip.referencedMemory ?? undefined
        }
      : undefined,
    reflectionReady: parsed.reflectionReady ?? false
  }
}
