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

// Three jagged, icicle-fringed silhouettes for the Arctic Survivalist's
// bubbles (see BubbleTheme.shape === 'ice') -- percentage-based so they
// scale to any bubble size, with points past 100% on the bottom edge so
// the icicle tips actually hang past the bubble's normal boundary rather
// than just notching its inside edge. Picked per-message (not randomly on
// every render) via a cheap hash of the message id, purely for variety so
// bubbles in a row don't all look identically jagged.
const ICE_CLIP_PATHS = [
  'polygon(3% 14%, 14% 2%, 27% 10%, 40% 0%, 53% 9%, 66% 1%, 79% 11%, 92% 2%, 100% 13%, 96% 28%, 100% 42%, 94% 58%, 100% 72%, 90% 80%, 94% 122%, 82% 82%, 78% 108%, 68% 80%, 64% 130%, 54% 81%, 50% 105%, 40% 80%, 36% 124%, 26% 81%, 22% 110%, 12% 80%, 8% 118%, 0% 79%, 4% 64%, 0% 50%, 5% 36%, 0% 22%)',
  'polygon(0% 10%, 12% 0%, 25% 8%, 38% 1%, 51% 10%, 64% 0%, 77% 9%, 90% 1%, 100% 11%, 95% 26%, 100% 44%, 96% 60%, 100% 76%, 92% 82%, 88% 115%, 80% 83%, 76% 128%, 66% 82%, 62% 106%, 52% 83%, 48% 120%, 38% 82%, 34% 104%, 24% 83%, 20% 126%, 10% 82%, 6% 112%, 0% 80%, 3% 66%, 0% 52%, 4% 38%, 0% 24%)',
  'polygon(4% 16%, 16% 4%, 29% 12%, 42% 2%, 55% 11%, 68% 3%, 81% 12%, 94% 4%, 100% 15%, 97% 30%, 100% 46%, 93% 62%, 100% 74%, 88% 81%, 92% 108%, 84% 82%, 80% 124%, 70% 81%, 66% 100%, 56% 82%, 52% 116%, 42% 81%, 38% 130%, 28% 82%, 24% 106%, 14% 81%, 10% 120%, 0% 80%, 5% 60%, 0% 46%, 6% 32%, 0% 18%)'
]

function iceClipPathFor(messageId: string): string {
  let hash = 0
  for (let i = 0; i < messageId.length; i++) hash = (hash * 31 + messageId.charCodeAt(i)) >>> 0
  return ICE_CLIP_PATHS[hash % ICE_CLIP_PATHS.length]
}

// No bubbles, no fills, by default — the two speakers are distinguished by
// alignment and a quiet italic on the user's own words, like a transcript
// rather than a messaging app. Only when a character theme supplies a
// `bubbles` treatment do real bubbles replace that plain-text look.
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
    const isIce = bubbles.shape === 'ice'
    const clipPath = isIce ? iceClipPathFor(message.id) : undefined
    return (
      <div className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
        {!isUser && <FedoraIcon color={bubbles.timestampColor} />}
        <div
          className="max-w-[78%] flex flex-col"
          style={isUser ? { marginRight: staggerOffset } : { marginLeft: staggerOffset }}
        >
          <div
            className={isIce ? 'text-[15px] leading-relaxed' : 'rounded-2xl px-4 py-3 text-[15px] leading-relaxed'}
            style={{
              background: isUser ? bubbles.userBg : bubbles.assistantBg,
              color: isUser ? bubbles.userText : bubbles.assistantText,
              fontFamily,
              borderBottomRightRadius: !isIce && isUser ? 4 : undefined,
              borderBottomLeftRadius: !isIce && !isUser ? 4 : undefined,
              ...(isIce
                ? {
                    clipPath,
                    WebkitClipPath: clipPath,
                    padding: '16px 16px 30px 16px',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    filter: 'drop-shadow(2px 4px 5px rgba(0,10,20,0.35))'
                  }
                : { padding: undefined })
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
