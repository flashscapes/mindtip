import type { AIContext, AIProvider, AIResponse } from './AIProvider'
import { StreamingResponseError } from './AIProvider'

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
 *
 * Two request shapes to the SAME endpoint, distinguished by whether a
 * character is present: character conversations get a streamed plain-text
 * response (read incrementally below, feeding onChunk as it grows); the
 * default MindTip experience still gets one JSON blob with its tip field,
 * exactly as before. See server/routes/generate.ts for the server side of
 * this split.
 */
export class GeminiProvider implements AIProvider {
  async generateResponse(context: AIContext, onChunk?: (textSoFar: string) => void): Promise<AIResponse> {
    return context.character
      ? this.generateStreamingCharacterResponse(context, onChunk)
      : this.generateDefaultResponse(context)
  }

  private async generateDefaultResponse(context: AIContext): Promise<AIResponse> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

    // A plain fetch with no timeout can hang forever if the server call
    // stalls rather than erroring — that leaves the UI stuck on "Thinking…"
    // with nothing to catch. This guarantees it eventually fails visibly.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)

    let res: Response
    try {
      res = await fetch(`${apiBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
        signal: controller.signal
      })
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out after 25s — MindTip may be slow to respond right now.')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI request failed with status ${res.status}${body ? ` — ${body.slice(0, 1000)}` : ''}`)
    }

    return (await res.json()) as AIResponse
  }

  private async generateStreamingCharacterResponse(
    context: AIContext,
    onChunk?: (textSoFar: string) => void
  ): Promise<AIResponse> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

    // Generous relative to the default path's 25s: a full multi-sentence
    // streamed reply can legitimately take longer start-to-finish than a
    // single blocking call, and the whole point of streaming is that the
    // person is already seeing words appear long before this would ever
    // matter — it exists purely to catch a connection that's truly stuck.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 35000)

    let res: Response
    try {
      res = await fetch(`${apiBaseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
        signal: controller.signal
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request timed out — MindTip may be slow to respond right now.')
      }
      throw err
    }

    if (!res.ok || !res.body) {
      clearTimeout(timeoutId)
      const body = await res.text().catch(() => '')
      throw new Error(`AI request failed with status ${res.status}${body ? ` — ${body.slice(0, 1000)}` : ''}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        onChunk?.(fullText)
      }
    } catch (err) {
      // A partial reply may already be visible on screen via onChunk --
      // the caller (Conversation.tsx) is responsible for deciding whether
      // to keep it and mark it cut off, rather than this layer discarding
      // it. Attach whatever streamed so far to the error for that purpose.
      const partial = fullText.trim() ? fullText : undefined
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out — MindTip may be slow to respond right now.'
          : `Stream interrupted${err instanceof Error ? `: ${err.message}` : ''}`
      throw new StreamingResponseError(message, partial)
    } finally {
      clearTimeout(timeoutId)
    }

    if (!fullText.trim()) {
      throw new Error('Received an empty response.')
    }

    return { replyText: fullText }
  }
}
