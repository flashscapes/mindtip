import type { Memory, Message, UserProfile } from '@/types'

export interface ReflectionInput {
  messages: Message[]
  profile: UserProfile
  relevantMemories: Memory[]
}

export interface ReflectionResult {
  reflection: string
  patterns: string
  anchoring: string
  insights: string
}

export interface ReflectionGenerator {
  generate(input: ReflectionInput): Promise<ReflectionResult>
}
