import type { Message } from '@/types'
import type { BubbleTheme, InkColors } from '@/lib/characterThemes'
import { TipCard } from './TipCard'

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Tiny fedora glyph — same silhouette used elsewhere in noir's theming, at
// icon scale, so the detective always has a quiet visual "signature" next
// to his side of the conversation.
function FedoraIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 60 44" width="22" height="16" className="flex-shrink-0 mb-1">
      <ellipse cx="30" cy="20" rx="13" ry="15" fill={color} />
      <path d="M6 18 Q30 2 54 18 Q54 23 46 21.5 Q30 14.5 14 21.5 Q6 23 6 18 Z" fill={color} />
    </svg>
  )
}

// No bubbles, no fills, by default — the two speakers are distinguished by
// alignment and a quiet italic on the user's own words, like a transcript
// rather than a messaging app. Only when a character theme supplies a
// `bubbles` treatment (currently just the noir detective) do real rounded,
// staggered message bubbles replace that plain-text look.
export function ChatBubble({
  message,
  fontFamily,
  textColor,
  bubbles,
  staggerOffset = 0,
  inkColors,
  lineHeight
}: {
  message: Message
  fontFamily?: string
  textColor?: string
  bubbles?: BubbleTheme
  staggerOffset?: number
  inkColors?: InkColors
  lineHeight?: number
}) {
  const isUser = message.role === 'user'

  if (bubbles) {
    return (
      <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && <FedoraIcon color={bubbles.timestampColor} />}
        <div
          className="max-w-[78%] flex flex-col"
          style={isUser ? { marginRight: staggerOffset } : { marginLeft: staggerOffset }}
        >
          <div
            className="rounded-2xl px-4 py-3 text-[15px] leading-relaxed"
            style={{
              background: isUser ? bubbles.userBg : bubbles.assistantBg,
              color: isUser ? bubbles.userText : bubbles.assistantText,
              fontFamily,
              borderBottomRightRadius: isUser ? 4 : undefined,
              borderBottomLeftRadius: isUser ? undefined : 4
            }}
          >
            {message.content}
          </div>
          <p
            className={`text-[11px] mt-1 flex items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}
            style={{ color: bubbles.timestampColor, fontFamily }}
          >
            {formatTime(message.createdAt)}
            {isUser && <span aria-hidden="true">✓</span>}
          </p>
          {message.tip && <TipCard tip={message.tip} />}
        </div>
      </div>
    )
  }

  if (inkColors) {
    return (
      <div className="flex flex-col items-start">
        <p
          className="max-w-[90%] text-[16px]"
          style={{
            fontFamily,
            lineHeight: lineHeight ? `${lineHeight}px` : undefined,
            color: isUser ? inkColors.user : inkColors.assistant,
            fontStyle: isUser ? 'normal' : 'italic'
          }}
        >
          {message.content}
        </p>
        {message.tip && <TipCard tip={message.tip} />}
      </div>
    )
  }

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
