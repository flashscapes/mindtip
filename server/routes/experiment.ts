// DESTINATION: server/routes/experiment.ts
import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Memory, UserProfile } from '../../src/types'
import { EXPERIMENT_SYSTEM_PROMPT } from '../prompts/experiment.js'

export const experimentRouter = Router()

const apiKey = process.env.GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(apiKey ?? '')

experimentRouter.post('/experiment', async (req, res) => {
  const { memories, profile } = req.body as { memories?: Memory[]; profile?: UserProfile }

  if (!memories?.length || !profile) {
    res.status(400).json({ error: 'Request is missing memories or profile.' })
    return
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    const memoryLines = memories
      .map(m => `- (${m.type}, confidence ${m.confidence}) ${m.content}`)
      .join('\n')

    const prompt = [
      EXPERIMENT_SYSTEM_PROMPT,
      'RECENT MEMORIES (most recent first)',
      memoryLines
    ].join('\n\n')

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const cleaned = raw.replace(/^```json\s*|```$/g, '').trim()
    const parsed = JSON.parse(cleaned) as { experiment: string | null }

    res.json({ experiment: parsed.experiment ?? null })
  } catch (err) {
    console.error('Experiment generation failed:', err)
    // Best-effort background enrichment — fail soft to "no experiment"
    // rather than surface an error anywhere in the UI.
    res.status(200).json({ experiment: null })
  }
})
