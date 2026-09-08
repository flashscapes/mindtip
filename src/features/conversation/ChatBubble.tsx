import type { Message } from '@/types'
import { TipCard } from './TipCard'

// No bubbles, no fills — the two speakers are distinguished by alignment
// and a quiet italic on the user's own words, like a transcript rather
// than a messaging app.
export function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <p className={`max-w-[85%] text-[16px] leading-relaxed ${isUser ? 'text-mist italic text-right' : 'text-ivory'}`}>
        {message.content}
      </p>
      {message.tip && <TipCard tip={message.tip} />}
    </div>
  )
}
