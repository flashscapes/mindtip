import type { MemoryExtractionInput, MemoryExtractionResult, MemoryExtractor } from './MemoryExtractor'

/**
 * Calls our own server route, which performs the actual extraction call
 * against whichever model is configured server-side (see
 * server/services/memoryExtraction). The client has no knowledge of which
 * model that is — this class stays identical whether the server is
 * running Gemini, OpenAI, or Claude behind it.
 *
 * Uses the same VITE_API_BASE_URL as GeminiProvider — see its comment for
 * why that matters on static hosts.
 */
export class RemoteMemoryExtractor implements MemoryExtractor {
  async extract(input: MemoryExtractionInput): Promise<MemoryExtractionResult> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const res = await fetch(`${apiBaseUrl}/api/extract-memory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })

    if (!res.ok) {
      throw new Error(`Memory extraction request failed with status ${res.status}`)
    }

    return (await res.json()) as MemoryExtractionResult
  }
}
