import type { Memory, UserProfile } from '@/types'

// The three memory types the extractor already produces that correspond
// exactly to the three profile fields buildContext renders in every prompt.
// Everything else it extracts (patterns, situational context) stays purely
// in memory, where per-turn relevance matching is the right treatment.
const PROMOTABLE: Record<string, 'triggers' | 'whatHelps' | 'whatDoesntHelp'> = {
  trigger: 'triggers',
  effective_strategy: 'whatHelps',
  ineffective_strategy: 'whatDoesntHelp'
}

// Higher than the bar for an ordinary memory, deliberately. A memory only
// reaches the model when the current message happens to match its keywords;
// a profile entry is in EVERY prompt from now on, so a wrong one colours
// every future conversation with every character rather than just one turn.
const MIN_CONFIDENCE = 0.6

// A cap, not a budget to fill. Past roughly this many the prompt stops
// reading as "here is who this person is" and starts diluting the entries
// that matter -- the model treats a long list as noise.
const MAX_PER_FIELD = 7

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

/**
 * Copies the durable facts the extractor has found out of memory and into
 * the profile, which is the only channel that reaches the model
 * unconditionally.
 *
 * This reads ALL memories rather than just the ones from the conversation
 * that triggered it, so anything captured before this existed gets picked
 * up on the next exit instead of being stranded.
 *
 * Returns null when nothing would change, so the caller can skip a
 * pointless write and re-render.
 */
export function promoteMemoriesIntoProfile(profile: UserProfile, memories: Memory[]): UserProfile | null {
  const candidates = memories
    .filter(m => m.active && m.confidence >= MIN_CONFIDENCE && PROMOTABLE[m.type])
    // Best first, so that when the cap bites it is the weakest new claims
    // that fall off rather than whichever happened to be extracted last.
    .sort((a, b) => b.confidence - a.confidence)

  if (candidates.length === 0) return null

  const next: UserProfile = { ...profile }
  let changed = false

  for (const field of ['triggers', 'whatHelps', 'whatDoesntHelp'] as const) {
    const existing = profile[field] ?? []
    const seen = new Set(existing.map(normalize))
    const additions: string[] = []

    for (const memory of candidates) {
      if (PROMOTABLE[memory.type] !== field) continue
      const content = memory.content.trim()
      const key = normalize(content)
      if (!key || seen.has(key)) continue
      seen.add(key)
      additions.push(content)
    }

    if (additions.length === 0) continue

    // Newest wins when the cap is reached. Once promoted, an entry is a
    // bare string with no confidence or timestamp left to rank it by, and
    // recency is the honest proxy for currency -- someone who changed jobs
    // should stop being described by last year's trigger.
    const merged = [...existing, ...additions].slice(-MAX_PER_FIELD)
    next[field] = merged
    changed = true
  }

  return changed ? next : null
}
