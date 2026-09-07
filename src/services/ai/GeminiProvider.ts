import type { AIContext, AIProvider, AIResponse } from './AIProvider'

/**
 * Talks to our own server route (server/routes/generate.ts), which holds
 * the Gemini API key and makes the actual model call — the key never
 * reaches the browser. Implements the same AIProvider interface as
 * MockAIProvider, so nothing that calls this needs to know which one it's using.
 *
 * apiBaseUrl matters on static hosts (GitHub Pages, etc.) that can't run
 * the Express server themselves: there, VITE_API_BASE_URL must point at
 * wherever server/ is actually deployed (Render, Railway, a VPS...).
 * Left unset, requests are same-origin — correct for local dev, where
 * Vite's proxy forwards /api/* to the local server.
 */
export class GeminiProvider implements AIProvider {
  async generateResponse(context: AIContext): Promise<AIResponse> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const res = await fetch(`${apiBaseUrl}/api/generate`, {
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
