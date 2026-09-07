import type { AIContext, AIProvider, AIResponse } from './AIProvider'

/**
 * Talks to our own server route (server/routes/generate.ts), which holds
 * the Gemini API key and makes the actual model call — the key never
 * reaches the browser. Implements the same AIProvider interface as
 * MockAIProvider, so nothing that calls this needs to know which one it's using.
 */
export class GeminiProvider implements AIProvider {
  async generateResponse(context: AIContext): Promise<AIResponse> {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(context)
    })

    if (!res.ok) {
      throw new Error(`AI request failed with status ${res.status}`)
    }

    return (await res.json()) as AIResponse
  }
}
