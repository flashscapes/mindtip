import type { AIProvider } from './AIProvider'
import { MockAIProvider } from './MockAIProvider'
import { GeminiProvider } from './GeminiProvider'

/**
 * Which provider the app uses is controlled entirely by VITE_AI_PROVIDER —
 * no code change needed to switch. Defaults to 'mock' so the app runs
 * with zero setup; set VITE_AI_PROVIDER=gemini (and GEMINI_API_KEY on the
 * server) to talk to a real model.
 */
export function createAIProvider(): AIProvider {
  const provider = import.meta.env.VITE_AI_PROVIDER ?? 'mock'
  return provider === 'gemini' ? new GeminiProvider() : new MockAIProvider()
}
