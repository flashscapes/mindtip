import { Router } from 'express'
import type { AIContext } from '../../src/services/ai/AIProvider.js'
import { generateWithGemini, streamCharacterResponseWithGemini } from '../services/gemini.js'

export const generateRouter = Router()

generateRouter.post('/generate', async (req, res) => {
  const context = req.body as Partial<AIContext>

  // currentMessage is allowed to be empty specifically for a re-entry
  // check-in (see initiateReentry in Conversation.tsx) -- there genuinely
  // is no "current message" for that call, only prior history. Checking
  // !context.currentMessage here would treat that empty string as missing
  // and reject every single re-entry attempt with a 400 before it ever
  // reaches Gemini, which is exactly what was happening.
  if ((!context?.currentMessage && !context?.isReentry) || !context?.profile) {
    res.status(400).json({ error: 'Request is missing profile or currentMessage.' })
    return
  }

  // Character conversations stream plain text (see gemini.ts for why);
  // the default MindTip experience still needs a single structured JSON
  // response for its tip field, so it keeps the original request/response
  // shape entirely unchanged.
  if (context.character) {
    try {
      await streamCharacterResponseWithGemini(context as AIContext, res)
      res.end()
    } catch (err) {
      console.error('Gemini streaming failed:', err)
      if (!res.headersSent) {
        // Failed before any bytes went out — a normal JSON error response
        // is still possible, and the client's existing error handling
        // already knows how to show it.
        res.status(502).json({ error: 'MindTip hit a snag generating a response. Try that again.' })
      } else {
        // Already sent a text/plain response and at least some of it may
        // already be showing on screen. Calling res.end() here would look
        // *identical* to a normal successful completion to the client's
        // stream reader -- a clean end and a broken one are otherwise
        // indistinguishable, and a mid-stream failure would silently read
        // as success. Destroying the connection instead is the correct
        // HTTP-level way to signal an incomplete response: it violates
        // chunked encoding's proper termination, which fetch's reader
        // surfaces as a real read error the client can actually catch.
        res.destroy()
      }
    }
    return
  }

  try {
    const response = await generateWithGemini(context as AIContext)
    res.json(response)
  } catch (err) {
    console.error('Gemini generation failed:', err)
    res.status(502).json({ error: 'MindTip hit a snag generating a response. Try that again.' })
  }
})
