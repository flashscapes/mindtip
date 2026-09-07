import { Router } from 'express'
import type { Message, UserProfile } from '../../src/types'
import { createMemoryExtractionModel } from '../services/memoryExtraction'

export const extractMemoryRouter = Router()
const memoryExtractionModel = createMemoryExtractionModel()

extractMemoryRouter.post('/extract-memory', async (req, res) => {
  const { messages, profile } = req.body as { messages?: Message[]; profile?: UserProfile }

  if (!messages?.length || !profile) {
    res.status(400).json({ error: 'Request is missing messages or profile.' })
    return
  }

  try {
    const result = await memoryExtractionModel.extract({ messages, profile })
    res.json(result)
  } catch (err) {
    console.error('Memory extraction failed:', err)
    // Extraction is best-effort background enrichment — fail soft so a bad
    // extraction call never surfaces as an error in the conversation itself.
    res.status(502).json({ memories: [] })
  }
})
