import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Response } from 'express'
import type { AIContext, AIResponse } from '../../src/services/ai/AIProvider.js'
import { MINDTIP_SYSTEM_PROMPT } from '../prompts/system.js'
import { buildUserContextBlock } from '../prompts/buildContext.js'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.warn('GEMINI_API_KEY is not set — Gemini calls will fail until it is added to .env')
}

const genAI = new GoogleGenerativeAI(apiKey ?? '')
const MODEL_NAME = 'gemini-3.6-flash'

// ---------- Default (character-less) path: unchanged ----------
//
// Ask Gemini to return strict JSON matching AIResponse, so the route can
// map it directly onto the shape the rest of the app already expects — no
// text parsing, no prompt-to-UI translation layer. This path still needs
// the structured tip field, so it stays a single blocking call rather than
// a stream (a tip can't be reliably parsed out of a still-arriving JSON
// object without waiting for it to close anyway).
const DEFAULT_RESPONSE_FORMAT_INSTRUCTIONS = `
Respond with ONLY a JSON object, no markdown fencing, no commentary, in exactly this shape:
{
  "replyText": string,
  "tip": { "headline": string, "action": string, "referencedMemory": string | null } | null
}
Set "tip" to null on any turn that is validating and/or exploring rather than advising — see your instructions on when to move from exploration to insight to action.`

export async function generateWithGemini(context: AIContext): Promise<AIResponse> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })

  const prompt = [
    MINDTIP_SYSTEM_PROMPT,
    DEFAULT_RESPONSE_FORMAT_INSTRUCTIONS,
    buildUserContextBlock(context),
    buildCurrentMessageBlock(context)
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

// ---------- Character path: streamed plain text ----------
//
// Character conversations never produce a tip (see the CHARACTER_PLAIN_TEXT
// _INSTRUCTIONS below and the ChatBubble/gemini history for why), so there's
// no structured object to wait for — the model's reply can be asked for as
// plain text and streamed straight through to the client as it's generated,
// instead of the client waiting for the entire reply before anything
// appears. This is the actual latency fix: generation time was always the
// dominant cost, and it was previously spent entirely as dead air.
const CHARACTER_PLAIN_TEXT_INSTRUCTIONS = `
Respond with ONLY the character's reply as plain text — no JSON, no markdown fencing, no labels, no meta-commentary, nothing but the words the character actually says. There is no separate tip field in this conversation — a structured tip card popping up mid-conversation would break the character entirely. If you have an actionable suggestion, say it in the character's own voice as part of the reply itself.`

// Builds the block that goes at the very end of the prompt, after the
// RECENT CONVERSATION history from buildUserContextBlock. Normally that's
// just the person's current message. For a re-entry (see AIContext.isReentry
// and ConversationStore.ts), there is no current message at all -- the
// RECENT CONVERSATION block already holds the actual prior transcript, and
// this asks the model to open with a real check-in grounded in it, rather
// than replying to anything or summarizing the conversation back to them.
function buildCurrentMessageBlock(context: AIContext): string {
  if (context.isReentry) {
    return `RE-ENTRY MOMENT
The person just reopened this conversation after being away for a while. The conversation above is real prior history with them, not a summary — use it. Do not replay, recap, or summarize it back to them. Generate ONE brief, warm, natural check-in grounded in a specific detail from that history — the way you'd actually greet someone you were mid-conversation with — then stop and wait for their reply.`
  }
  return `CURRENT MESSAGE\n${context.currentMessage}`
}

/**
 * Streams a character conversation's reply directly onto an already-open
 * Express response as plain text chunks, and returns the fully assembled
 * text once the stream ends (so the caller can still do whatever normal
 * post-processing it does with a complete reply — memory, thresholds, etc.
 * — the streaming is purely about when the client sees it, not what it is).
 *
 * Deliberately does not catch errors — the route handler owns deciding what
 * to do if this throws before vs. after headers/chunks have already gone
 * out, since that changes what kind of error response is even possible.
 */
export async function streamCharacterResponseWithGemini(context: AIContext, res: Response): Promise<string> {
  const model = genAI.getGenerativeModel({ model: MODEL_NAME })

  const prompt = [
    MINDTIP_SYSTEM_PROMPT,
    CHARACTER_PLAIN_TEXT_INSTRUCTIONS,
    buildUserContextBlock(context),
    buildCurrentMessageBlock(context)
  ].join('\n\n')

  const result = await model.generateContentStream(prompt)

  res.setHeader('Content-Type', 'text/plain; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  // Node/Express: send headers immediately rather than letting them sit
  // buffered until the handler returns — the whole point is the client
  // starts receiving bytes as soon as the model starts producing them.
  res.flushHeaders()

  let fullText = ''
  for await (const chunk of result.stream) {
    // .text() throws if this particular chunk's candidate was blocked
    // (safety filtering) — let that propagate to the route handler rather
    // than silently swallowing it, since a genuinely blocked response is a
    // real error condition, not something to paper over with empty text.
    const chunkText = chunk.text()
    if (chunkText) {
      fullText += chunkText
      res.write(chunkText)
    }
  }

  return fullText
}
