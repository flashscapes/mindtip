import type { Memory, MemoryType } from '@/types'
import { STORAGE_KEYS } from '@/lib/constants'

// Common English words excluded from relevance scoring — without this,
// "the", "and", "with" etc. match almost any memory content, making the
// filter return nearly everything regardless of actual relevance.
const STOPWORDS = new Set([
  'this', 'that', 'these', 'those', 'with', 'from', 'have', 'about',
  'been', 'were', 'they', 'them', 'their', 'what', 'when', 'where',
  'which', 'while', 'would', 'could', 'should', 'there', 'here',
  'just', 'like', 'really', 'very', 'much', 'more', 'some', 'such',
  'into', 'over', 'again', 'still', 'even', 'only', 'also', 'always',
  'never', 'want', 'need', 'feel', 'feeling', 'think', 'know', 'going',
  'right', 'today', 'tomorrow', 'again'
])

/**
 * Structured long-term memory, separate from raw conversation history.
 * V1 implementation is localStorage-backed; the interface is what matters —
 * swapping in a real database/vector store later means implementing this
 * same shape, not touching any component.
 */
export interface MemoryService {
  getAll(): Memory[]
  getRelevant(currentMessage: string, limit?: number): Memory[]
  remember(type: MemoryType, content: string, confidence: number, source: Memory['source'], expiresAt?: string): Memory
  forget(id: string): void
  clearAll(): void
}

export class LocalMemoryService implements MemoryService {
  private read(): Memory[] {
    const raw = localStorage.getItem(STORAGE_KEYS.memories)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      // Per-entry validation — a single corrupted record (missing/invalid
      // content, wrong types) must not be allowed through: getRelevant()
      // calls .toLowerCase() on every memory's content on every turn, so
      // an entry with a non-string content would throw uncaught and break
      // the current conversation, not just fail to load quietly.
      return (parsed as unknown[]).filter((m): m is Memory => {
        if (!m || typeof m !== 'object') return false
        const r = m as Record<string, unknown>
        return (
          typeof r.id === 'string' &&
          typeof r.type === 'string' &&
          typeof r.content === 'string' && r.content.length > 0 &&
          typeof r.confidence === 'number' &&
          typeof r.active === 'boolean' &&
          typeof r.createdAt === 'string'
        )
      })
    } catch (err) {
      console.error('Stored memories were corrupted and could not be read — starting fresh.', err)
      return []
    }
  }

  private write(memories: Memory[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.memories, JSON.stringify(memories))
    } catch (err) {
      // Distinct from an extraction/API failure — this is specifically the
      // local save step failing (e.g. storage quota exceeded), so it gets
      // its own clear log rather than bubbling up to be misreported as an
      // extraction failure by the caller.
      console.error('Failed to save memory to local storage:', err)
      throw err
    }
  }

  getAll(): Memory[] {
    const now = Date.now()
    return this.read().filter(m => m.active && (!m.expiresAt || new Date(m.expiresAt).getTime() > now))
  }

  /**
   * V1 relevance: keyword overlap on meaningful words only. This is the
   * seam to replace with embedding-based retrieval later — callers don't
   * need to change.
   *
   * Two things matter here and were previously broken: (1) whole-word
   * matching, not substring — content.includes(w) treated "i" as a match
   * for "anxiety" and "his"; (2) a stopword/length filter, since without
   * one, common words like "the", "a", "to" match almost any memory,
   * making the filter return nearly everything regardless of real
   * relevance.
   */
  getRelevant(currentMessage: string, limit = 3): Memory[] {
    const words = currentMessage
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    const scored = this.getAll().map(memory => {
      const contentWords = new Set(memory.content.toLowerCase().split(/\W+/))
      const score = words.reduce((acc, w) => (contentWords.has(w) ? acc + 1 : acc), 0)
      return { memory, score }
    })
    const withMatches = scored.filter(s => s.score > 0)
    if (withMatches.length === 0) return [] // no genuine overlap — say nothing rather than guess
    return withMatches
      .sort((a, b) => b.score - a.score || b.memory.confidence - a.memory.confidence)
      .slice(0, limit)
      .map(s => s.memory)
  }

  remember(type: MemoryType, content: string, confidence: number, source: Memory['source'], expiresAt?: string): Memory {
    const memory: Memory = {
      id: crypto.randomUUID(),
      type,
      content,
      confidence,
      source,
      createdAt: new Date().toISOString(),
      active: true,
      ...(expiresAt ? { expiresAt } : {})
    }
    this.write([...this.read(), memory])
    return memory
  }

  forget(id: string): void {
    this.write(this.read().filter(m => m.id !== id))
  }

  clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.memories)
  }
}
