import type { ReflectionGenerator, ReflectionInput, ReflectionResult } from './ReflectionGenerator'

/**
 * Calls our own server route (see server/routes/reflect.ts), which performs
 * the actual synthesis call against whichever model is configured
 * server-side. Same VITE_API_BASE_URL pattern as GeminiProvider and
 * RemoteMemoryExtractor.
 */
export class RemoteReflectionGenerator implements ReflectionGenerator {
  async generate(input: ReflectionInput): Promise<ReflectionResult> {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
    const res = await fetch(`${apiBaseUrl}/api/reflect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input)
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Reflection request failed with status ${res.status}${body ? ` — ${body.slice(0, 200)}` : ''}`)
    }

    return (await res.json()) as ReflectionResult
  }
}
