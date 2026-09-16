import type { Message } from '@/types'

const STORAGE_KEY = 'mindtip.conversations'

export interface ConversationRecord {
  id: string
  messages: Message[]
  updatedAt: string
}

function readAll(): Record<string, ConversationRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ConversationRecord>) : {}
  } catch {
    return {}
  }
}

function writeAll(map: Record<string, ConversationRecord>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch (err) {
    console.error('Failed to save conversation record:', err)
  }
}

/**
 * One durable record per conversation id -- currently the character's key
 * (or 'default' for the character-less mood-based flow), since this app
 * has no concept of multiple simultaneous threads with the same character,
 * so the character key already IS the conversation id; no separate id
 * system is introduced.
 *
 * localStorage, not sessionStorage: this must survive closing the app,
 * not just a same-tab reload -- that distinction is deliberate. The
 * existing sessionStorage-based mindtip.conversation key (see
 * Conversation.tsx) still separately governs "reload without ever
 * leaving" and is untouched by this file.
 *
 * Deliberately never cleared on conversation exit -- the whole point of
 * this store is that it's still there next time the person picks this
 * character again.
 */
export function getConversationRecord(id: string): ConversationRecord | null {
  return readAll()[id] ?? null
}

export function saveConversationRecord(id: string, messages: Message[]): void {
  if (messages.length === 0) return
  const all = readAll()
  all[id] = { id, messages, updatedAt: new Date().toISOString() }
  writeAll(all)
}
