import { useMemo, useRef, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { createAIProvider } from '@/services/ai'
import { useVoiceConversation } from '@/voice'

interface WelcomeProps {
  onComplete: () => void
}

// The chat that runs here is NOT a route — see the comment above `phase`
// below. It talks to the same AI service Conversation.tsx uses, which takes
// a profile as a plain field on its context object. The person has not
// onboarded yet, so there is no real profile; this stands in for one.
//
// It cannot simply be omitted: server/routes/generate.ts rejects a request
// with no profile (400). Empty arrays are the honest answer here rather than
// invented preferences — buildContext renders each as "none stated", which
// is exactly true of someone who has not answered those questions yet.
const GUEST_PROFILE: UserProfile = {
  id: 'guest',
  supportStyle: 'blend',
  triggers: [],
  whatHelps: [],
  whatDoesntHelp: [],
  proactiveCheckIns: false,
  onboardedAt: new Date(0).toISOString(),
  onboardingCompleted: false
}

// How many replies the opening chat gives before offering the handoff. Two
// is deliberate: enough to surface what they are dealing with and what they
// want from it, not enough to start solving it here -- solving it is what
// choosing a character is for.
const EXCHANGES_BEFORE_HANDOFF = 2

const OPENING_LINE = "What's on your mind?"

function newMessage(role: Message['role'], content: string): Message {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

// A small, decorative "premium" lens-glare accent — a soft bright core plus
// a thin horizontal streak, blended with `screen` so it brightens whatever
// sits behind it rather than covering it like a flat sticker. Purely
// cosmetic, sits under the title text.
function LensGlare() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 -translate-x-1/2"
      style={{ bottom: -10, width: 220, height: 46, mixBlendMode: 'screen' }}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 90,
          height: 34,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,250,235,0.95) 0%, rgba(255,220,160,0.5) 35%, rgba(255,200,140,0) 75%)',
          filter: 'blur(2px)'
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '100%',
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,235,200,0.85) 50%, transparent 100%)'
        }}
      />
    </div>
  )
}

export function Welcome({ onComplete }: WelcomeProps) {
  const ai = useMemo(() => createAIProvider(), [])

  // 'intro' is the original title block; 'chat' swaps it for the conversation.
  // Both render into the SAME grid cell (see the .grid below) so the swap is a
  // cross-fade in place: no route change, no screen change, and the collage,
  // wash and orb do not move. onComplete is deliberately NOT called here --
  // it fires only from the handoff button at the end.
  const [phase, setPhase] = useState<'intro' | 'chat'>('intro')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [showHandoff, setShowHandoff] = useState(false)

  // Mirrors `messages` synchronously. The voice path can invoke an older
  // `send` closure whose captured `messages` is frozen, so history is read
  // from here instead -- same reason Conversation.tsx keeps one.
  const messagesRef = useRef<Message[]>([])
  const isGeneratingRef = useRef(false)
  const repliesRef = useRef(0)

  const setMessagesAndRef = (updater: (prev: Message[]) => Message[]) => {
    setMessages(prev => {
      const next = updater(prev)
      messagesRef.current = next
      return next
    })
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isGeneratingRef.current) return
    isGeneratingRef.current = true
    setInput('')
    setMessagesAndRef(prev => [...prev, newMessage('user', trimmed)])
    setIsThinking(true)

    try {
      // The same service call Conversation.tsx makes -- not a second chat
      // implementation. No character is chosen yet, so this takes the
      // provider's non-streaming path and the reply arrives whole.
      const response = await ai.generateResponse({
        profile: GUEST_PROFILE,
        relevantMemories: [],
        recentMessages: messagesRef.current,
        currentMessage: trimmed
      })
      setMessagesAndRef(prev => [...prev, newMessage('assistant', response.replyText)])
      repliesRef.current += 1
      if (repliesRef.current >= EXCHANGES_BEFORE_HANDOFF) setShowHandoff(true)
      void voice.speakResponse(response.replyText)
    } catch (err) {
      console.error('Welcome chat generation failed:', err)
      setMessagesAndRef(prev => [
        ...prev,
        newMessage('assistant', "I didn't catch that one. Try me again?")
      ])
      // Never strand someone on a dead screen: if the opener fails they can
      // still move on rather than being stuck tapping a broken orb.
      setShowHandoff(true)
    } finally {
      setIsThinking(false)
      isGeneratingRef.current = false
    }
  }

  const voice = useVoiceConversation({ onUserSpeech: send })

  const handleOrbTap = () => {
    if (phase === 'intro') {
      setPhase('chat')
      setMessagesAndRef(() => [newMessage('assistant', OPENING_LINE)])
      return
    }
    // In chat, the orb is the voice trigger. enableVoiceConversation must run
    // from a real tap -- Safari only grants the mic from a user gesture.
    if (!voice.enabled) void voice.enableVoiceConversation()
    else voice.disableVoiceConversation()
  }

  const orbLabel =
    phase === 'intro' ? 'Tap to begin' : voice.enabled ? 'Stop talking' : 'Tap and talk'

  return (
    <div
      className="relative min-h-dvh flex flex-col overflow-hidden"
      style={{
        backgroundImage: "url('/images/welcome-hero.jpg')",
        backgroundSize: '100% auto',
        backgroundPosition: 'top center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: '#1a1206'
      }}
    >
      {/* Readability wash — lightest over the portraits at the very top
          (already dark), deepest by the time it reaches the bright sky
          where the title sits, then fading toward the fallback color below
          the image's own bottom edge so the transition isn't an abrupt seam. */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.1) 0%, rgba(5,5,10,0.25) 22%, rgba(5,5,10,0.55) 45%, rgba(10,7,3,0.8) 70%, #1a1206 100%)' }}
      />

      {/* Spacer pushes the title block to land roughly a third of the way
          down the screen, below the five character portraits. */}
      <div style={{ height: '33vh', flexShrink: 0 }} />

      <div className="relative z-10 flex flex-col items-center px-6 text-center w-full max-w-sm mx-auto">
        {/* Both states share one grid cell, so the cross-fade swaps them in
            place without the surrounding layout shifting by a pixel. */}
        <div className="grid w-full">
          <div
            className="col-start-1 row-start-1 transition-all duration-500"
            style={{
              opacity: phase === 'intro' ? 1 : 0,
              transform: phase === 'intro' ? 'none' : 'translateY(6px)',
              pointerEvents: phase === 'intro' ? undefined : 'none'
            }}
            aria-hidden={phase !== 'intro'}
          >
            <div className="relative inline-block">
              <p
                className="font-sans text-[64px] leading-[0.9] tracking-[0.04em]"
                style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  backgroundImage: 'linear-gradient(135deg, #8FD4F0 0%, #EAF6FF 28%, #FFFFFF 48%, #FFA35C 68%, #FF6B2E 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  filter: 'drop-shadow(0 2px 10px rgba(0,0,0,0.6))'
                }}
              >
                MINDTIP
              </p>
              <LensGlare />
            </div>
            <p className="font-display italic text-[18px] mt-1.5 mb-1.5" style={{ color: '#E8C878' }}>
              Therapy
            </p>
            <p
              className="text-[13px] tracking-[0.15em]"
              style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878' }}
            >
              FRESH PERSPECTIVES THROUGH<br />DYNAMIC ROLES
            </p>
            <p className="font-display text-[15px] leading-relaxed mt-4 max-w-[240px] mx-auto" style={{ color: '#F0EEE8' }}>
              Choose a character. Talk through what's on your mind. Leave with a brand-new lens on your life.
            </p>
          </div>

          <div
            className="col-start-1 row-start-1 transition-all duration-500"
            style={{
              opacity: phase === 'chat' ? 1 : 0,
              transform: phase === 'chat' ? 'none' : 'translateY(6px)',
              pointerEvents: phase === 'chat' ? undefined : 'none'
            }}
            aria-hidden={phase !== 'chat'}
          >
            <div className="flex flex-col w-full max-w-[280px] mx-auto">
              {/* The thread scrolls within the title block's footprint, so a
                  growing conversation never pushes the orb off-screen. */}
              <div
                className="flex flex-col gap-2.5 overflow-y-auto pr-1"
                style={{ maxHeight: '34vh' }}
                aria-live="polite"
              >
                {messages.map(m => (
                  <p
                    key={m.id}
                    className="font-display text-[15px] leading-relaxed px-4 py-3"
                    style={
                      m.role === 'user'
                        ? {
                            alignSelf: 'flex-end',
                            textAlign: 'right',
                            background: 'rgba(232,200,120,0.90)',
                            color: '#1B1408',
                            borderRadius: '20px 20px 6px 20px',
                            maxWidth: '86%'
                          }
                        : {
                            alignSelf: 'flex-start',
                            textAlign: 'left',
                            background: 'rgba(255,255,255,0.10)',
                            border: '1px solid rgba(232,200,120,0.30)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            color: '#F0EEE8',
                            borderRadius: '20px 20px 20px 6px',
                            maxWidth: '86%',
                            boxShadow: '0 8px 22px rgba(0,0,0,0.35)'
                          }
                    }
                  >
                    {m.content}
                  </p>
                ))}
                {isThinking && (
                  <p className="font-display italic text-[14px] self-start" style={{ color: 'rgba(240,238,232,0.7)' }}>
                    Thinking…
                  </p>
                )}
              </div>

              <form
                onSubmit={e => {
                  e.preventDefault()
                  void send(input)
                }}
                className="flex items-center gap-2 mt-3.5 pb-2"
                style={{ borderBottom: '1px solid rgba(232,200,120,0.35)' }}
              >
                <input
                  id="welcome-chat-input"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type here, or tap the orb and talk"
                  className="flex-1 bg-transparent outline-none font-display text-[14px]"
                  style={{ color: '#F0EEE8' }}
                  aria-label="Message"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="disabled:opacity-40"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878', fontSize: 14, letterSpacing: '0.08em' }}
                >
                  SEND
                </button>
              </form>

              {/* Offered, never forced: the conversation is not interrupted or
                  auto-advanced, so nobody gets pulled off the screen
                  mid-thought. Tapping this is the only thing that leaves. */}
              {showHandoff && (
                <button
                  onClick={onComplete}
                  className="mt-4 rounded-full transition-transform duration-300 hover:-translate-y-0.5"
                  style={{
                    border: '1.5px solid #D4A94A',
                    background: 'rgba(10,14,20,0.6)',
                    padding: '10px 20px'
                  }}
                >
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878', fontSize: 14, letterSpacing: '0.08em' }}>
                    CHOOSE WHO YOU TALK TO →
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1" />

      <div className="relative z-10 flex flex-col items-center gap-3 mb-8">
        <button
          onClick={handleOrbTap}
          aria-label={orbLabel}
          className="mindtip-welcome-orb rounded-full"
          style={{
            width: 72,
            height: 72,
            border: 0,
            padding: 0,
            background:
              'radial-gradient(circle at 38% 34%, #AEB6FF 0%, #7C86F0 46%, rgba(124,134,240,0.34) 74%, rgba(124,134,240,0) 100%)'
          }}
        />
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", color: '#E8C878', fontSize: 13, letterSpacing: '0.13em' }}>
          {phase === 'intro' ? 'TAP TO BEGIN.' : voice.enabled ? 'LISTENING…' : 'TAP AND TALK'}
        </span>
      </div>
    </div>
  )
}
