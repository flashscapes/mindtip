import type { Message } from '@/types'
import { TipCard } from './TipCard'

// No bubbles, no fills — the two speakers are distinguished by alignment
// and a quiet italic on the user's own words, like a transcript rather
// than a messaging app.
export function ChatBubble({ message, fontFamily, textColor }: { message: Message; fontFamily?: string; textColor?: string }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[85%] text-[16px] leading-relaxed ${isUser ? 'italic text-right' : ''} ${textColor ? '' : isUser ? 'text-mist' : 'text-ivory'}`}
        style={{ ...(fontFamily ? { fontFamily } : {}), ...(textColor ? { color: textColor, opacity: isUser ? 0.75 : 1 } : {}) }}
      >
        {message.content}
      </p>
      {message.tip && <TipCard tip={message.tip} />}
    </div>
  )
}
