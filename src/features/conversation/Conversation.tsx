import { useEffect, useMemo, useRef, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { createAIProvider } from '@/services/ai'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createMemoryExtractor } from '@/services/memory'
import { SafetyService } from '@/services/safety/SafetyService'
import { useVoiceConversation } from '@/voice'
import { ChatBubble } from './ChatBubble'
import { Button } from '@/components/ui/Button'
import { STORAGE_KEYS } from '@/lib/constants'

interface ConversationProps {
  profile: UserProfile
  initialMessage?: string
  // Lets a conversation resume with prior history intact (e.g. "Continue
  // talking" after a Reflection) instead of always starting empty.
  seedMessages?: Message[]
  // When true, hands-free voice is enabled before the first message is
  // sent — used when the user arrives here via the Home mood check-in,
  // which already unlocked audio playback during its own tap.
  autoEnableVoice?: boolean
  // Called when the person taps "Emerging Insights" (or accepts a spoken
  // suggestion by saying "yes"). Hands the full transcript up so a
  // Reflection can be generated from it.
  onReflectionReady: (messages: Message[]) => void
  onExit: () => void
}

export function Conversation({ profile, initialMessage, seedMessages, autoEnableVoice, onReflectionReady, onExit }: ConversationProps) {
  const ai = useMemo(() => createAIProvider(), [])
  const memory = useMemo(() => new LocalMemoryService(), [])
  const memoryExtractor = useMemo(() => createMemoryExtractor(), [])
  const safety = useMemo(() => new SafetyService(), [])

  const [messages, setMessages] = useState<Message[]>(seedMessages ?? [])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  // True only in the single turn right after MindTip has verbally
  // suggested Emerging Insights — lets a short spoken "yes" accept that
  // specific suggestion. It is NOT what gates access to the feature; the
  // header action (see canReflect below) is always available regardless
  // of this value once there's enough conversation.
  const [justSuggested, setJustSuggested] = useState(false)
  const [lastRequestDebug, setLastRequestDebug] = useState('')
  const started = useRef(false)

  // Emerging Insights unlocks once there's enough conversation to reflect
  // on — a plain, always-visible action from here on, not a one-time,
  // timed invitation. Recomputed from current message count on every
  // render, so no separate state or one-time gating is needed.
  const canReflect = messages.filter(m => m.role === 'user').length >= 2

  // Persist the in-progress conversation every time it changes, so a full
  // page reload (a hard refresh, or iOS backgrounding/reloading the PWA
  // under memory pressure) doesn't silently destroy it — App.tsx restores
  // from this on mount. Cleared only when the conversation ends
  // deliberately (see App.tsx's onExit), never on a reload.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.conversation, JSON.stringify(messages))
  }, [messages])

  if (import.meta.env.DEV) {
    // Lightweight, dev-only visibility into what's actually being sent —
    // exactly what Phase 11 of the audit asked for, kept minimal rather
    // than a full diagnostics panel.
    console.debug(`[MindTip] ${messages.length} messages in this conversation`)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    // A short, clear "yes" right after MindTip verbally suggested Emerging
    // Insights accepts that suggestion — mainly for hands-free voice users
    // who aren't looking at the screen. A longer reply (even one starting
    // with "yes") falls through to a normal turn instead, so real answers
    // never get hijacked. This is a courtesy shortcut only; the header
    // action works regardless of whether this ever fires.
    const isSpokenAcceptance = /^(yes|yeah|yep|sure|okay|ok|please|show me|let'?s see it|go ahead)\.?$/i.test(trimmed)
    if (justSuggested && isSpokenAcceptance) {
      onReflectionReady(messages)
      return
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setJustSuggested(false)

    const safetyResult = safety.check(trimmed)
    if (safetyResult.level === 'crisis') {
      setJustSuggested(false)
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: safetyResult.resourceMessage ?? '',
          createdAt: new Date().toISOString()
        }
      ])
      return
    }

    setIsThinking(true)
    const relevantMemories = memory.getRelevant(trimmed)
    // TEMPORARY real-evidence capture — shows exactly what's about to be
    // sent, live, on screen (not console, since this needs to be visible
    // on iPhone). Remove once the actual failing-turn payload has been seen.
    setLastRequestDebug(
      `HISTORY (${messages.length} msgs): ` +
      messages.map(m => `[${m.role}] ${m.content.slice(0, 40)}`).join(' | ') +
      ` || MEMORIES (${relevantMemories.length}): ` +
      (relevantMemories.length ? relevantMemories.map(m => m.content).join(' | ') : 'none') +
      ` || CURRENT: ${trimmed}`
    )
    let response
    try {
      response = await ai.generateResponse({
        profile,
        relevantMemories,
        recentMessages: messages,
        currentMessage: trimmed
      })
    } catch (err) {
      setIsThinking(false)
      console.error('AI response generation failed:', err)
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "MindTip hit a snag putting that together. Mind trying again?",
          createdAt: new Date().toISOString()
        }
      ])
      return
    }
    setIsThinking(false)

    // A one-time, low-stakes verbal courtesy: the moment the conversation
    // first reaches a reasonable depth, mention aloud that Emerging
    // Insights is available. Fires exactly once per conversation (strict
    // equality, not >=) so it never repeats on later turns — the header
    // action remains available the whole time regardless, so missing or
    // ignoring this moment costs nothing.
    const userMessageCount = messages.filter(m => m.role === 'user').length + 1
    const justCrossedSuggestionThreshold = userMessageCount === 4
    setJustSuggested(justCrossedSuggestionThreshold)

    setMessages(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.replyText,
        createdAt: new Date().toISOString(),
        tip: response.tip
      }
    ])

    if (response.tip && profile.whatHelps.some(h => response.tip!.action.toLowerCase().includes(h.toLowerCase()))) {
      memory.remember('effective_strategy', response.tip.action, 0.6, 'conversation')
    }

    void voice.speakResponse(
      justCrossedSuggestionThreshold
        ? `${response.replyText} By the way, there's an Emerging Insights option now if you'd like to see what's coming together — just say "yes", or keep going.`
        : response.replyText
    )
  }

  const voice = useVoiceConversation({ onUserSpeech: send })

  /**
   * Best-effort background enrichment, run once when the user leaves this
   * conversation: hands the transcript to the memory extractor (a real
   * model call in production, a lightweight heuristic in mock mode — see
   * services/memory/index.ts) and persists whatever patterns, triggers, or
   * effective/ineffective strategies it finds. Deliberately fire-and-forget
   * — extraction never blocks or delays actually exiting the conversation,
   * and a failure here is silent to the user (logged only), matching how
   * the server route itself fails soft.
   */
  const extractionStarted = useRef(false)

  const extractMemoriesFromThisConversation = async () => {
    if (extractionStarted.current) return // rapid double-tap on Close — never run this twice
    extractionStarted.current = true

    if (messages.length < 2) {
      localStorage.setItem('mindtip_extraction_debug', `Skipped: only ${messages.length} message(s), need 2+`)
      return
    }

    try {
      const result = await memoryExtractor.extract({ messages, profile })
      localStorage.setItem('mindtip_extraction_debug', `Extractor returned: ${JSON.stringify(result)}`)
      const existingContent = memory.getAll().map(m => m.content.trim().toLowerCase())

      for (const item of result.memories) {
        const key = item.content.trim().toLowerCase()
        if (!key || existingContent.includes(key)) continue // avoid duplicate buildup across sessions
        const expiresAt =
          item.type === 'situational_context'
            ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString() // 10 days — long enough to follow up, short enough not to linger
            : undefined
        memory.remember(item.type, item.content, item.confidence, 'conversation', expiresAt)
        existingContent.push(key)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      localStorage.setItem('mindtip_extraction_debug', `Extraction FAILED: ${msg}`)
      console.error('Memory extraction failed:', err)
    }
  }

  const handleExit = () => {
    void extractMemoriesFromThisConversation()
    onExit()
  }

  useEffect(() => {
    if (started.current) return
    started.current = true

    const run = async () => {
      if (autoEnableVoice) {
        try {
          // Awaited so `enabledRef` is true by the time `send` below checks
          // it — that's what makes the spoken response, and the automatic
          // listen-for-reply afterward, actually happen.
          await voice.enableVoiceConversation()
        } catch (err) {
          console.error('Could not enable hands-free voice automatically:', err)
        }
      }
      if (initialMessage) {
        void send(initialMessage)
      } else if (autoEnableVoice) {
        // No initial message means nothing will trigger the usual
        // speak-response-then-listen chain (e.g. resuming via "Continue
        // talking" after a Reflection) — start listening directly so
        // voice actually stays hands-free instead of silently sitting
        // enabled-but-idle until the person types something.
        voice.startListening()
      }
    }
    void run()
    // Intentionally runs once on mount to auto-send the message the user
    // arrived with (e.g. from the Home mood check-in); `send` itself is
    // stable enough in practice here, and re-running on every identity
    // change would risk re-sending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-dvh bg-canvas flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid rgba(37,56,58,0.08)' }}>
        <span className="font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</span>
        <div className="flex items-center gap-5">
          {canReflect && (
            <button
              onClick={() => onReflectionReady(messages)}
              className="text-[13px] text-bronze hover:opacity-80 transition-opacity duration-300"
            >
              ✦ Emerging Insights
            </button>
          )}
          <button
            onClick={() => (voice.enabled ? voice.disableVoiceConversation() : voice.enableVoiceConversation())}
            className={`text-[13px] transition-colors duration-300 ${voice.enabled ? 'text-bronze' : 'text-mist hover:text-bronze'}`}
          >
            {voice.enabled ? (voice.state === 'idle' ? 'Voice on' : voice.state) : 'Voice off'}
          </button>
          <button onClick={handleExit} className="text-[13px] text-mist hover:text-bronze transition-colors duration-300">Close</button>
        </div>
      </header>

      {/* TEMPORARY diagnostic — shows the live mic level vs threshold while
          listening, so we can see real numbers instead of guessing at
          another threshold value. Remove once the right threshold is
          confirmed. */}
      {voice.enabled && voice.debugLog && (
        <p className="px-8 py-1 text-[11px] text-bronze bg-white/40 break-words">{voice.debugLog}</p>
      )}

      {/* TEMPORARY — the actual request contents from the last turn sent,
          so we can see real evidence instead of reconstructing it. Remove
          once the failing-turn payload has actually been captured. */}
      {lastRequestDebug && (
        <p className="px-8 py-2 text-[10px] text-mist bg-white/60 break-words leading-relaxed">{lastRequestDebug}</p>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-10 flex flex-col gap-6">
        {messages.map(m => (
          <ChatBubble key={m.id} message={m} />
        ))}
        {isThinking && <p className="text-mist italic text-[14px]">Thinking…</p>}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-center gap-4 px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ borderTop: '1px solid rgba(37,56,58,0.08)' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tell me what's on your mind…"
          className="flex-1 bg-transparent text-[15px] text-ivory placeholder:text-mist outline-none pb-2"
          style={{ borderBottom: '1px solid rgba(37,56,58,0.14)' }}
        />
        <Button type="submit" disabled={!input.trim()}>Send</Button>
      </form>
    </div>
  )
}
