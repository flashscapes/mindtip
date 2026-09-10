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

Set "reflectionReady" to true once BOTH of these are true:
- the person has sent at least 3 messages in this conversation (not counting their very first one)
- you could point to one specific, concrete thing from what they've actually said — a person, a repeated situation, a particular tension — rather than only a generic theme that could apply to anyone

This is a low-stakes signal, not a claim about the person's psychology: it just offers an easy-to-decline invitation to see a reflection, and they can simply keep talking instead. Don't hold it to a high bar — once there is real, specific material to work with, lean toward true rather than false.`

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
