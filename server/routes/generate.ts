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
    res.status(502).json({ error: 'MindTip hit a snag generating a response. Try that again.' })
  }
})
