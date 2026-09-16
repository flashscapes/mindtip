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
//
// The tip field is only offered on default (character-less) conversations.
// A structured tip card popping up mid-roleplay is jarring and breaks the
// character illusion entirely, so when a character persona is active the
// model isn't even given the option to produce one — the schema itself
// only has replyText, and any actionable suggestion has to be folded into
// the character's own natural reply instead.
const DEFAULT_RESPONSE_FORMAT_INSTRUCTIONS = `
Respond with ONLY a JSON object, no markdown fencing, no commentary, in exactly this shape:
{
  "replyText": string,
  "tip": { "headline": string, "action": string, "referencedMemory": string | null } | null
}
Set "tip" to null on any turn that is validating and/or exploring rather than advising — see your instructions on when to move from exploration to insight to action.`

const CHARACTER_RESPONSE_FORMAT_INSTRUCTIONS = `
Respond with ONLY a JSON object, no markdown fencing, no commentary, in exactly this shape:
{
  "replyText": string
}
There is no separate tip field in this conversation — a character persona is active, and a structured tip card popping up mid-conversation would break the character entirely. If you have an actionable suggestion, say it in the character's own voice as part of replyText.`

export async function generateWithGemini(context: AIContext): Promise<AIResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

  const responseFormatInstructions = context.character
    ? CHARACTER_RESPONSE_FORMAT_INSTRUCTIONS
    : DEFAULT_RESPONSE_FORMAT_INSTRUCTIONS

  const prompt = [
    MINDTIP_SYSTEM_PROMPT,
    responseFormatInstructions,
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
