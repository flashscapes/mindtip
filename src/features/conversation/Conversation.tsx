import { useMemo, useRef, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { MockAIProvider } from '@/services/ai/MockAIProvider'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { SafetyService } from '@/services/safety/SafetyService'
import { ChatBubble } from './ChatBubble'
import { Button } from '@/components/ui/Button'

interface ConversationProps {
  profile: UserProfile
  initialMessage?: string
  onExit: () => void
}

export function Conversation({ profile, initialMessage, onExit }: ConversationProps) {
  const ai = useMemo(() => new MockAIProvider(), [])
  const memory = useMemo(() => new LocalMemoryService(), [])
  const safety = useMemo(() => new SafetyService(), [])

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(initialMessage ?? '')
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
  }

  if (!started.current && initialMessage) {
    started.current = true
    void send(initialMessage)
  }

  return (
    <div className="min-h-dvh bg-canvas flex flex-col max-w-md mx-auto">
      <header className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid rgba(244,241,234,0.08)' }}>
        <span className="font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</span>
        <button onClick={onExit} className="text-[13px] text-mist hover:text-bronze transition-colors duration-300">Close</button>
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
        style={{ borderTop: '1px solid rgba(244,241,234,0.08)' }}
      >
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Tell me what's on your mind…"
          className="flex-1 bg-transparent text-[15px] text-ivory placeholder:text-mist outline-none pb-2"
          style={{ borderBottom: '1px solid rgba(244,241,234,0.14)' }}
        />
        <Button type="submit" disabled={!input.trim()}>Send</Button>
      </form>
    </div>
  )
}
