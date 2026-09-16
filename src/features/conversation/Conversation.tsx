import { useEffect, useMemo, useRef, useState } from 'react'
import type { Character, Message, UserProfile } from '@/types'
import { createAIProvider } from '@/services/ai'
import { StreamingResponseError } from '@/services/ai/AIProvider'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createMemoryExtractor } from '@/services/memory'
import { SafetyService } from '@/services/safety/SafetyService'
import { useVoiceConversation } from '@/voice'
import { ChatBubble } from './ChatBubble'
import { Button } from '@/components/ui/Button'
import { STORAGE_KEYS } from '@/lib/constants'
import { getConversationRecord, saveConversationRecord } from '@/services/conversation/ConversationStore'
import { CHARACTER_THEMES } from '@/lib/characterThemes'
import { NoirSkyline } from './NoirSkyline'
import { StudyDesk } from './StudyDesk'
import { GlacierPeaks } from './GlacierPeaks'
import { InfantryCamp } from './InfantryCamp'
import { AstronautOrbit } from './AstronautOrbit'

interface ConversationProps {
  profile: UserProfile
  initialMessage?: string
  // Lets a conversation resume with prior history intact (e.g. "Continue
  // talking" after a Reflection) instead of always starting empty.
  seedMessages?: Message[]
  // Set when App.tsx finds a saved conversation record for the chosen
  // character (see ConversationStore.ts). The actual prior transcript --
  // fed to the AI as history but never rendered on screen. Its presence
  // (rather than seedMessages/initialMessage) is what triggers a natural
  // check-in on mount instead of the generic first message.
  reentryContext?: Message[]
  // When true, hands-free voice is enabled before the first message is
  // sent — used when the user arrives here via the Home mood check-in,
  // which already unlocked audio playback during its own tap.
  autoEnableVoice?: boolean
  // Set once when a character was chosen on Home — included in every turn
  // for the whole conversation, not just the first, so the persona voice
  // stays consistent throughout. Undefined for conversations started via
  // free text or continued from Reflection/Experiment.
  character?: Character
  // Called when the person taps "Emerging Insights" (or accepts a spoken
  // suggestion by saying "yes"). Hands the full transcript up so a
  // Reflection can be generated from it.
  onReflectionReady: (messages: Message[]) => void
  onExit: () => void
}

export function Conversation({ profile, initialMessage, seedMessages, reentryContext, autoEnableVoice, character, onReflectionReady, onExit }: ConversationProps) {
  const ai = useMemo(() => createAIProvider(), [])
  const memory = useMemo(() => new LocalMemoryService(), [])
  const memoryExtractor = useMemo(() => createMemoryExtractor(), [])
  const safety = useMemo(() => new SafetyService(), [])
  // The character's key already is the conversation id in this app's model
  // (see ConversationStore.ts) -- 'default' covers the character-less flow.
  const conversationId = character?.key ?? 'default'
  // The actual prior transcript on a re-entry, kept out of the visible
  // `messages` state entirely (never rendered) but always prepended to
  // what's sent to the AI as history -- see send() and initiateReentry()
  // below. Empty for a brand-new conversation.
  const hiddenPriorMessagesRef = useRef<Message[]>(reentryContext ?? [])

  const [messages, setMessages] = useState<Message[]>(seedMessages ?? [])
  // Mirrors `messages` synchronously. The voice loop can end up re-invoking
  // an old `send` closure (see the fix note at its call sites below) whose
  // captured `messages` variable is permanently frozen from whenever that
  // closure was created — this ref is what `recentMessages` actually reads
  // from instead, so it's always the true current value regardless of
  // which closure generation happens to be executing.
  const messagesRef = useRef<Message[]>(messages)
  const setMessagesAndRef = (updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  // Separate from isThinking on purpose: isThinking now only controls the
  // "Thinking…" text and clears the moment the first streamed chunk
  // arrives (once real content is visible, the placeholder text should go
  // away). This ref blocks re-submission for the *entire* duration of a
  // response, streaming or not, all the way through to completion or
  // error — without it, a second message could be sent while the first
  // one is still streaming in, since isThinking would already read false.
  const isGeneratingRef = useRef(false)
  // True only in the single turn right after MindTip has verbally
  // suggested Emerging Insights — lets a short spoken "yes" accept that
  // specific suggestion. It is NOT what gates access to the feature; the
  // header action (see canReflect below) is always available regardless
  // of this value once there's enough conversation.
  const [justSuggested, setJustSuggested] = useState(false)
  const started = useRef(false)

  // Emerging Insights unlocks once there's enough conversation to reflect
  // on — a plain, always-visible action from here on, not a one-time,
  // timed invitation. Recomputed from current message count on every
  // render, so no separate state or one-time gating is needed.
  const canReflect = messages.filter(m => m.role === 'user').length >= 4

  // Persist the in-progress conversation every time it changes, so a full
  // page reload (a hard refresh, or iOS backgrounding/reloading the PWA
  // under memory pressure) doesn't silently destroy it — App.tsx restores
  // from this on mount. Cleared only when the conversation ends
  // deliberately (see App.tsx's onExit), never on a reload.
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEYS.conversation, JSON.stringify(messages))

    // Separately, the durable per-character record used for true re-entry
    // (see ConversationStore.ts) — this one is deliberately NOT cleared on
    // exit, and holds the FULL history (whatever was already there from a
    // prior sitting, plus this session's messages), not just what's
    // currently visible on screen.
    if (messages.length > 0) {
      saveConversationRecord(conversationId, [...hiddenPriorMessagesRef.current, ...messages])
    }
  }, [messages])

  if (import.meta.env.DEV) {
    // Lightweight, dev-only visibility into what's actually being sent —
    // exactly what Phase 11 of the audit asked for, kept minimal rather
    // than a full diagnostics panel.
    console.debug(`[MindTip] ${messagesRef.current.length} messages in this conversation`)
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isGeneratingRef.current) return

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
    setMessagesAndRef(prev => [...prev, userMessage])
    setInput('')
    setJustSuggested(false)

    const safetyResult = safety.check(trimmed)
    if (safetyResult.level === 'crisis') {
      setJustSuggested(false)
      setMessagesAndRef(prev => [
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
    isGeneratingRef.current = true
    const relevantMemories = memory.getRelevant(trimmed)

    // Character conversations stream in progressively: the assistant
    // message is created the moment the first chunk lands and updated in
    // place as more text arrives, instead of appearing all at once after
    // the full reply is ready. The default (non-character) path never
    // calls this callback at all, so it behaves exactly as before.
    const assistantMessageId = crypto.randomUUID()
    let streamedMessageCreated = false

    const handleChunk = (textSoFar: string) => {
      if (!streamedMessageCreated) {
        streamedMessageCreated = true
        setIsThinking(false)
        setMessagesAndRef(prev => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: textSoFar, createdAt: new Date().toISOString() }
        ])
      } else {
        setMessagesAndRef(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: textSoFar } : m)))
      }
    }

    let response: Awaited<ReturnType<typeof ai.generateResponse>>
    try {
      response = await ai.generateResponse(
        {
          profile,
          character,
          relevantMemories,
          recentMessages: [...hiddenPriorMessagesRef.current, ...messagesRef.current],
          currentMessage: trimmed
        },
        handleChunk
      )
    } catch (err) {
      setIsThinking(false)
      console.error('AI response generation failed:', err)

      const partial = err instanceof StreamingResponseError ? err.partialText : undefined
      if (streamedMessageCreated && partial) {
        // Some of the reply already streamed onto screen — keep it and
        // mark it cut off with a separate, clearly-system notice, rather
        // than discarding visible content or writing the notice into the
        // character's own words.
        setMessagesAndRef(prev =>
          prev.map(m => (m.id === assistantMessageId ? { ...m, content: partial, truncated: true } : m))
        )
      } else if (streamedMessageCreated) {
        setMessagesAndRef(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, content: "MindTip hit a snag putting that together. Mind trying again?" }
              : m
          )
        )
      } else {
        setMessagesAndRef(prev => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: "MindTip hit a snag putting that together. Mind trying again?",
            createdAt: new Date().toISOString()
          }
        ])
      }
      // Without this, an error mid-voice-conversation leaves the mic
      // silently off with no way to continue except leaving and starting
      // over — exactly the kind of "the chat just dies" experience this
      // whole pass exists to eliminate. If voice was on, let the person
      // just try again by speaking.
      if (voice.enabled) voice.startListening()
      isGeneratingRef.current = false
      return
    }
    setIsThinking(false)
    isGeneratingRef.current = false

    // A one-time, low-stakes verbal courtesy: the moment the conversation
    // first reaches a reasonable depth, mention aloud that Emerging
    // Insights is available. Fires exactly once per conversation (strict
    // equality, not >=) so it never repeats on later turns — the header
    // action remains available the whole time regardless, so missing or
    // ignoring this moment costs nothing.
    const userMessageCount = messagesRef.current.filter(m => m.role === 'user').length
    const justCrossedSuggestionThreshold = userMessageCount === 8
    setJustSuggested(justCrossedSuggestionThreshold)

    if (streamedMessageCreated) {
      // The message already exists on screen from streaming in — just
      // reconcile its final content (and tip, always undefined here, kept
      // only for shape-consistency) in case the last chunk hadn't landed yet.
      setMessagesAndRef(prev =>
        prev.map(m => (m.id === assistantMessageId ? { ...m, content: response.replyText, tip: response.tip } : m))
      )
    } else {
      setMessagesAndRef(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: response.replyText,
          createdAt: new Date().toISOString(),
          tip: response.tip
        }
      ])
    }

    if (response.tip && profile.whatHelps.some(h => response.tip!.action.toLowerCase().includes(h.toLowerCase()))) {
      memory.remember('effective_strategy', response.tip.action, 0.6, 'conversation')
    }

    void voice.speakResponse(
      justCrossedSuggestionThreshold
        ? `${response.replyText} By the way, there's an Emerging Insights option now if you'd like to see what's coming together — just say "yes", or keep going.`
        : response.replyText,
      character?.key
    )
  }

  // Fires once on mount instead of send() when reentryContext is present
  // (see App.tsx's handleStartConversation and ConversationStore.ts) — the
  // person is reopening a conversation that has real prior history. Rather
  // than replaying that history or sending the generic first message, this
  // asks the model for one grounded check-in based on it, and adds ONLY
  // that reply to the visible conversation -- no corresponding user-visible
  // message is ever added for this turn, since there wasn't one.
  const initiateReentry = async () => {
    setIsThinking(true)
    isGeneratingRef.current = true

    const assistantMessageId = crypto.randomUUID()
    let streamedMessageCreated = false
    const handleChunk = (textSoFar: string) => {
      if (!streamedMessageCreated) {
        streamedMessageCreated = true
        setIsThinking(false)
        setMessagesAndRef(prev => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: textSoFar, createdAt: new Date().toISOString() }
        ])
      } else {
        setMessagesAndRef(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: textSoFar } : m)))
      }
    }

    try {
      const response = await ai.generateResponse(
        {
          profile,
          character,
          relevantMemories: [],
          recentMessages: hiddenPriorMessagesRef.current,
          currentMessage: '',
          isReentry: true
        },
        handleChunk
      )

      if (streamedMessageCreated) {
        setMessagesAndRef(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: response.replyText } : m)))
      } else {
        setMessagesAndRef(prev => [
          ...prev,
          { id: assistantMessageId, role: 'assistant', content: response.replyText, createdAt: new Date().toISOString() }
        ])
      }
      void voice.speakResponse(response.replyText, character?.key)
    } catch (err) {
      console.error('Re-entry check-in generation failed:', err)
      const partial = err instanceof StreamingResponseError ? err.partialText : undefined
      if (streamedMessageCreated && partial) {
        setMessagesAndRef(prev => prev.map(m => (m.id === assistantMessageId ? { ...m, content: partial, truncated: true } : m)))
      } else if (!streamedMessageCreated) {
        // Fall back to a plain, honest opener rather than leaving the
        // screen blank — the person still sees something waiting for them.
        setMessagesAndRef(prev => [
          ...prev,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: "Good to have you back — pick up wherever feels right.",
            createdAt: new Date().toISOString()
          }
        ])
      }
      if (voice.enabled) voice.startListening()
    }

    setIsThinking(false)
    isGeneratingRef.current = false
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
    voice.disableVoiceConversation()
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
      if (reentryContext && reentryContext.length > 0) {
        void initiateReentry()
      } else if (initialMessage) {
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

  const theme = character ? CHARACTER_THEMES[character.key] : undefined

  // A small, stable (not re-randomized on every render) horizontal offset
  // per message, derived from its id — this is what keeps a run of same-
  // sender bubbles from lining up into a single straight edge. Only meant
  // to be used when a theme actually supplies real bubbles.
  const staggerFor = (messageId: string): number => {
    let hash = 0
    for (let i = 0; i < messageId.length; i++) hash = (hash * 31 + messageId.charCodeAt(i)) >>> 0
    return hash % 26
  }

  return (
    <div
      className={`min-h-dvh flex flex-col max-w-md mx-auto relative ${theme?.background ? '' : 'bg-canvas'}`}
      style={theme?.background ? { background: theme.background } : undefined}
    >
      {theme?.atmosphere === 'noir' && (
        <>
          <NoirSkyline />
          <div className="absolute inset-0 mindtip-noir-rain pointer-events-none" />
          <div className="absolute inset-0 mindtip-noir-fog pointer-events-none" />
          <svg viewBox="0 0 60 100" className="absolute bottom-4 right-4 w-14 opacity-25 pointer-events-none" style={{ filter: `drop-shadow(0 0 8px ${theme.accentColor})` }}>
            <ellipse cx="30" cy="30" rx="14" ry="16" fill={theme.accentColor} />
            <path d="M8 26 Q30 6 52 26 Q52 32 44 30 Q30 22 16 30 Q8 32 8 26 Z" fill={theme.accentColor} />
          </svg>
        </>
      )}
      {theme?.atmosphere === 'study' && <StudyDesk />}
      {theme?.atmosphere === 'arctic' && <GlacierPeaks />}
      {theme?.atmosphere === 'camp' && <InfantryCamp />}
      {theme?.atmosphere === 'orbit' && <AstronautOrbit />}
      <header className="relative flex items-center justify-between px-8 py-6" style={{ borderBottom: `1px solid ${theme?.accentColor ? theme.accentColor + '33' : 'rgba(37,56,58,0.08)'}` }}>
        <span className="font-sans text-[13px] tracking-[0.08em]" style={{ color: theme?.accentColor ?? '#345350' }}>MindTip</span>
        <div className="flex items-center gap-5">
          {canReflect && (
            <button
              onClick={() => onReflectionReady(messages)}
              className="text-[13px] hover:opacity-80 transition-opacity duration-300"
              style={{ color: theme?.accentColor ?? '#B8935A' }}
            >
              ✦ Emerging Insights
            </button>
          )}
          <button
            onClick={() => (voice.enabled ? voice.disableVoiceConversation() : voice.enableVoiceConversation())}
            className="text-[13px] transition-colors duration-300"
            style={{ color: voice.enabled ? (theme?.accentColor ?? '#B8935A') : '#345350' }}
          >
            {voice.enabled ? (voice.state === 'idle' ? 'Voice on' : voice.state) : 'Voice off'}
          </button>
          <button onClick={handleExit} className="text-[13px] transition-colors duration-300" style={{ color: theme?.accentColor ?? '#345350' }}>Close</button>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto px-8 py-10 flex flex-col gap-6" style={theme?.atmosphere === 'study' ? { paddingLeft: 60 } : undefined}>
        {messages.map(m => (
          <ChatBubble
            key={m.id}
            message={m}
            fontFamily={theme?.font}
            fontWeight={theme?.fontWeight}
            accentColor={theme?.accentColor}
            textColor={theme?.textColor}
            bubbles={theme?.bubbles}
            staggerOffset={theme?.bubbles ? staggerFor(m.id) : 0}
            inkColors={theme?.inkColors}
            lineHeight={theme?.lineHeight}
          />
        ))}
        {isThinking && (
          <p className={`italic text-[14px] ${theme?.textColor ? '' : 'text-mist'}`} style={theme?.textColor ? { color: theme.textColor, opacity: 0.7 } : undefined}>
            Thinking…
          </p>
        )}
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-center gap-4 px-8 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        style={{ borderTop: `1px solid ${theme?.accentColor ? theme.accentColor + '33' : 'rgba(37,56,58,0.08)'}` }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tell me what's on your mind…"
          className={`flex-1 bg-transparent text-[15px] outline-none pb-2 ${theme?.textColor ? 'mindtip-themed-input' : 'text-ivory placeholder:text-mist'}`}
          style={{
            borderBottom: `1px solid ${theme?.accentColor ? theme.accentColor + '4D' : 'rgba(37,56,58,0.14)'}`,
            color: theme?.textColor,
            fontFamily: theme?.font,
            fontWeight: theme?.fontWeight,
            ['--mindtip-placeholder-color' as string]: theme?.placeholderColor
          }}
        />
        <Button type="submit" disabled={!input.trim()}>Send</Button>
      </form>
    </div>
  )
}
