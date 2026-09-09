import { Router } from 'express'
import type { AIContext } from '../../src/services/ai/AIProvider.js'
import { generateWithGemini } from '../services/gemini.js'

export const generateRouter = Router()

generateRouter.post('/generate', async (req, res) => {
  const context = req.body as Partial<AIContext>

  if (!context?.currentMessage || !context?.profile) {
    res.status(400).json({ error: 'Request is missing profile or currentMessage.' })
    return
  }

  try {
    const response = await generateWithGemini(context as AIContext)
    res.json(response)
  } catch (err) {
    console.error('Gemini generation failed:', err)
    // TEMPORARY: full cause chain included for diagnosis — the SDK's
    // top-level err.message alone was truncated with no real reason
    // attached; the actual cause lives deeper in err.cause.
    let detail = err instanceof Error ? err.message : String(err)
    let cause: unknown = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined
    let depth = 0
    while (cause && depth < 4) {
      const causeMsg = cause instanceof Error ? cause.message : JSON.stringify(cause)
      detail += ` || caused by: ${causeMsg}`
      cause = cause instanceof Error ? (cause as Error & { cause?: unknown }).cause : undefined
      depth++
    }
    res.status(502).json({ error: 'MindTip hit a snag generating a response. Try that again.', detail })
  }
})
