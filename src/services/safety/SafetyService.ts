import type { SafetyLevel } from '@/types'

/**
 * Deliberately separate from the conversational personality (section 13).
 * V1 is a conservative keyword check. This is the seam to swap in a
 * proper classifier later without touching AIProvider or the UI.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(kill myself|suicid\w*|end my life|want to die|don'?t want to (be alive|live))\b/i,
  /\b(hurt|kill) (myself|someone|him|her|them)\b/i,
  /\b(self[- ]?harm|cutting myself)\b/i
]

export interface SafetyCheckResult {
  level: SafetyLevel
  resourceMessage?: string
}

export class SafetyService {
  check(message: string): SafetyCheckResult {
    const isCrisis = CRISIS_PATTERNS.some(pattern => pattern.test(message))
    if (!isCrisis) {
      return { level: 'normal' }
    }
    return {
      level: 'crisis',
      resourceMessage:
        "That sounds really heavy, and I want to make sure you're safe. If you're in the US, you can call or text 988 (Suicide & Crisis Lifeline) any time — they're there to help, not to judge. If you're in immediate danger, please call 911. I'm here when you want to keep talking."
    }
  }
}
