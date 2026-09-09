import { useEffect, useMemo, useRef, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { createAIProvider } from '@/services/ai'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createMemoryExtractor } from '@/services/memory'
import { SafetyService } from '@/services/safety/SafetyService'
import { useVoiceConversation } from '@/voice'
import { ChatBubble } from './ChatBubble'
import { Button } from '@/components/ui/Button'

interface ConversationProps {
  profile: UserProfile
  initialMessage?: string
  // When true, hands-free voice is enabled before the first message is
  // sent — used when the user arrives here via the Home mood check-in,
  // which already unlocked audio playback during its own tap.
  autoEnableVoice?: boolean
  onExit: () => void
}

export function Conversation({ profile, initialMessage, autoEnableVoice, onExit }: ConversationProps) {
  const ai = useMemo(() => createAIProvider(), [])
  const memory = useMemo(() => new LocalMemoryService(), [])
  const memoryExtractor = useMemo(() => createMemoryExtractor(), [])
  const safety = useMemo(() => new SafetyService(), [])

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const started = useRef(false)

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isThinking) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')

    const safetyResult = safety.check(trimmed)
    if (safetyResult.level === 'crisis') {
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
    const response = await ai.generateResponse({
      profile,
      relevantMemories,
      recentMessages: messages.slice(-6),
      currentMessage: trimmed
    })
    setIsThinking(false)

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

    void voice.speakResponse(response.replyText)
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
  const extractMemoriesFromThisConversation = async () => {
    if (messages.length < 2) return // nothing substantive happened yet

    try {
      const result = await memoryExtractor.extract({ messages, profile })
      const existingContent = memory.getAll().map(m => m.content.trim().toLowerCase())

      for (const item of result.memories) {
        const key = item.content.trim().toLowerCase()
        if (!key || existingContent.includes(key)) continue // avoid duplicate buildup across sessions
        memory.remember(item.type, item.content, item.confidence, 'conversation')
        existingContent.push(key)
      }
    } catch (err) {
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
          <button
            onClick={() => (voice.enabled ? voice.disableVoiceConversation() : voice.enableVoiceConversation())}
            className={`text-[13px] transition-colors duration-300 ${voice.enabled ? 'text-bronze' : 'text-mist hover:text-bronze'}`}
          >
            {voice.enabled ? (voice.state === 'idle' ? 'Voice on' : voice.state) : 'Voice off'}
          </button>
          <button onClick={handleExit} className="text-[13px] text-mist hover:text-bronze transition-colors duration-300">Close</button>
        </div>
      </header>

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
