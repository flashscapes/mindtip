// DESTINATION: server/routes/reflect.ts
import { Router } from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Memory, Message, UserProfile } from '../../src/types'
import { REFLECTION_SYSTEM_PROMPT } from '../prompts/reflection.js'
import { buildUserContextBlock } from '../prompts/buildContext.js'

export const reflectRouter = Router()

const apiKey = process.env.GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(apiKey ?? '')

interface ReflectionResult {
  reflection: string
  patterns: string
  anchoring: string
  insights: string
}

reflectRouter.post('/reflect', async (req, res) => {
  const { messages, profile, relevantMemories } = req.body as {
    messages?: Message[]
    profile?: UserProfile
    relevantMemories?: Memory[]
  }

  if (!messages?.length || !profile) {
    res.status(400).json({ error: 'Request is missing messages or profile.' })
    return
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

    // Reuses the same context-block formatter as regular turns, just fed
    // the FULL transcript rather than the last few messages — a Reflection
    // is meant to draw on the whole conversation, not the most recent turn.
    const contextBlock = buildUserContextBlock({
      profile,
      relevantMemories: relevantMemories ?? [],
      recentMessages: messages,
      currentMessage: ''
    })

    const prompt = [REFLECTION_SYSTEM_PROMPT, contextBlock].join('\n\n')

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const cleaned = raw.replace(/^```json\s*|```$/g, '').trim()
    const parsed = JSON.parse(cleaned) as ReflectionResult

    res.json(parsed)
  } catch (err) {
    console.error('Reflection generation failed:', err)
    res.status(502).json({ error: 'MindTip hit a snag putting the reflection together. Try again in a moment.' })
  }
})
