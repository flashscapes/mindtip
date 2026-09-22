import { useEffect, useRef, useState } from 'react'
import type { SupportStyle, UserProfile } from '@/types'
import { speakText, useVoiceConversation, unlockAudio } from '@/voice'

interface WelcomeProps {
  onComplete: (profile: UserProfile) => void
}

// The two questions asked here are the whole of onboarding now -- the
// former three-screen flow (name, then two "sky" constellation screens)
// was removed in favour of asking the only two things that actually get
// used, in the app's own conversational voice, without leaving this
// screen. Everything else the app learns, it learns by talking.
const NAME_QUESTION = 'What should I call you?'

const styleQuestion = (name: string) =>
  `${name}, when you're working through a tough problem or feeling stuck, what kind of perspective helps you most?`

// Said after the card tap, while the profile is being written and Home is
// coming up. Deliberately short: the tap already committed them, so this
// is a handoff, not another question.
const BRIDGE = "Good. Let's find you a sounding board."

// How long the bridge line stays on screen before Home takes over. Long
// enough to read, short enough not to feel like a stall.
const BRIDGE_HOLD_MS = 1500

// The four cards. `key` is written straight to profile.supportStyle and
// read by server/prompts/buildContext.ts, which turns it into delivery
// guidance for whichever character gets chosen on Home.
const STYLE_OPTIONS: { key: SupportStyle; label: string; blurb: string }[] = [
  { key: 'analytical', label: 'Direct & Analytical', blurb: 'Cut to the problem' },
  { key: 'empathetic', label: 'Warm & Empathetic', blurb: 'Feel heard first' },
  { key: 'big_picture', label: 'High-Level & Big Picture', blurb: 'Zoom out on it' },
  { key: 'tactical', label: 'Unconventional & Tactical', blurb: 'Work the angles' }
]

// Spoken answers to "what should I call you?" are rarely a bare name --
// people say "I'm Alvin" or "it's Alvin". Without this the whole sentence
// becomes preferredName and every screen greets them as "Good morning, My
// name is Alvin". Typed answers pass through this too and are unaffected,
// since they almost never carry a prefix.
const SPOKEN_NAME_PREFIX =
  /^(?:(?:hi|hey|hello|yeah|yes)[,\s]+)*(?:i'?m|my name is|my name's|it'?s|its|call me|this is|i am)\s+(.+)$/i

function cleanName(raw: string): string {
  const strip = (s: string) => s.trim().replace(/^[\s,.!?]+|[\s,.!?]+$/g, '')
  let text = strip(raw)
  const match = text.match(SPOKEN_NAME_PREFIX)
  if (match) text = strip(match[1])
  // A dictated ramble should not become someone's name. Three words is
  // generous for a real one ("Mary Anne Smith") and still cuts a sentence
  // off before it can become a greeting.
  return text.split(/\s+/).slice(0, 3).join(' ').slice(0, 40)
}

interface Line {
  id: string
  role: 'assistant' | 'user'
  text: string
}

function newLine(role: Line['role'], text: string): Line {
  return { id: crypto.randomUUID(), role, text }
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
  // 'intro' is the original title block; 'chat' swaps it for the questions.
  // Both render into the SAME grid cell (see the .grid below) so the swap is
  // a cross-fade in place: no route change, no screen change, and the
  // collage, wash and orb do not move.
  const [phase, setPhase] = useState<'intro' | 'chat'>('intro')
  // Which question is live. 'bridge' is the brief beat after the card tap,
  // before Home takes over -- nothing is interactive during it.
  const [step, setStep] = useState<'name' | 'style' | 'bridge'>('name')
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')

  // The voice path can invoke an older callback whose captured state is
  // frozen, so the step is read from here instead -- same reason
  // Conversation.tsx keeps a ref alongside its state.
  const stepRef = useRef<'name' | 'style' | 'bridge'>('name')
  const nameRef = useRef('')
  const threadRef = useRef<HTMLDivElement | null>(null)

  // Keep the newest line -- and the cards, which live inside this same
  // scroll region -- in view. Without this the style question and its cards
  // sit below the fold on a short phone with no sign they are there.
  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length, step])

  const say = (role: Line['role'], text: string) => setLines(prev => [...prev, newLine(role, text)])

  // The thread is capped by the space between the title block and the orb,
  // and the style question plus four cards does not fit alongside the name
  // exchange on a short phone -- the question's first line ends up scrolled
  // out of view. The name exchange is what gives way, because the style
  // question already opens with their name ("Alvin, when you're...") and
  // that confirms it was heard correctly better than an echoed bubble does.
  const visibleLines =
    step === 'name' ? lines : step === 'style' ? lines.slice(-1) : lines.slice(-2)

  const submitName = (raw: string) => {
    if (stepRef.current !== 'name') return
    const name = cleanName(raw)
    if (!name) return
    nameRef.current = name
    setInput('')
    say('user', name)
    stepRef.current = 'style'
    setStep('style')
    say('assistant', styleQuestion(name))
    if (voice.enabled) void voice.speakResponse(styleQuestion(name))
  }

  const pickStyle = (option: (typeof STYLE_OPTIONS)[number]) => {
    if (stepRef.current !== 'style') return
    // One tap does everything: answers the question, writes the profile and
    // moves to Home. It is also a real user gesture landing immediately
    // before Home mounts, which is what the browser requires before Home's
    // greeting is allowed to play aloud.
    unlockAudio()
    stepRef.current = 'bridge'
    setStep('bridge')
    say('user', option.label)
    say('assistant', BRIDGE)
    if (voice.enabled) void voice.speakResponse(BRIDGE)

    const profile: UserProfile = {
      id: crypto.randomUUID(),
      preferredName: nameRef.current || undefined,
      supportStyle: option.key,
      // Not asked any more -- the removed constellation screens collected
      // these. Empty arrays are the honest answer rather than invented
      // preferences; buildContext renders each as "none stated", and the
      // memory service fills them in from real conversation over time.
      triggers: [],
      whatHelps: [],
      whatDoesntHelp: [],
      proactiveCheckIns: false,
      onboardedAt: new Date().toISOString(),
      onboardingCompleted: true
    }
    window.setTimeout(() => onComplete(profile), BRIDGE_HOLD_MS)
  }

  // Only the name question can be answered by voice; the style question is
  // answered by tapping a card.
  const voice = useVoiceConversation({ onUserSpeech: submitName })

  const handleOrbTap = () => {
    if (phase === 'intro') {
      setPhase('chat')
      say('assistant', NAME_QUESTION)
      // This tap is the one real user gesture available, and both things
      // that need one happen inside it: Safari only grants the mic from a
      // gesture, and audio playback is only unlocked by one. So the mic is
      // opened here rather than on a second tap -- the question is asked
      // aloud and the answer can be spoken straight back.
      void (async () => {
        const micReady = await voice.enableVoiceConversation()
        if (micReady) {
          // speakResponse pauses the mic while it plays and resumes
          // listening 250ms after it finishes, so the question is never
          // heard as the answer.
          void voice.speakResponse(NAME_QUESTION)
        } else {
          // Mic refused or failed to start. The question should still be
          // asked out loud -- they can answer by typing instead.
          void speakText(NAME_QUESTION).catch(() => {})
        }
      })()
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
              {/* The cards scroll WITH the thread rather than sitting below
                  it: four cards are about 240px, which on a short phone
                  pushed the orb and its caption off the bottom of the
                  screen. One bounded region can never do that. */}
              <div
                ref={threadRef}
                className="flex flex-col gap-2.5 overflow-y-auto pr-1"
                style={{
                  // Fill exactly the gap between the title block's top edge
                  // and the orb rather than a fixed fraction of the screen:
                  // 33vh is the spacer above, 135px the orb and its caption
                  // below. A fixed vh either wasted space on a tall phone or
                  // ran past the orb on a short one.
                  maxHeight: step === 'name' ? '34vh' : 'calc(100dvh - 33vh - 135px)'
                }}
                aria-live="polite"
              >
                {visibleLines.map(l => (
                  <p
                    key={l.id}
                    className="font-sans text-[15px] leading-relaxed px-4 py-3"
                    style={
                      l.role === 'user'
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
                    {l.text}
                  </p>
                ))}
                {/* One tap answers and advances -- there is deliberately no
                    confirm step and no separate continue button. */}
                {step === 'style' && (
                  <div className="flex flex-col gap-2 mt-4">
                    {STYLE_OPTIONS.map(option => (
                      <button
                        key={option.key}
                        onClick={() => pickStyle(option)}
                        className="flex flex-col gap-0.5 text-left px-3.5 py-2.5 transition-transform duration-200 hover:-translate-y-0.5"
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(232,200,120,0.32)',
                          borderRadius: 16,
                          backdropFilter: 'blur(10px)',
                          WebkitBackdropFilter: 'blur(10px)',
                          boxShadow: '0 6px 18px rgba(0,0,0,0.30)'
                        }}
                      >
                        <span className="font-sans text-[14px] leading-tight" style={{ color: '#F0EEE8' }}>
                          {option.label}
                        </span>
                        <span className="text-[11px] leading-tight" style={{ color: 'rgba(240,238,232,0.62)' }}>
                          {option.blurb}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {step === 'name' && (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    submitName(input)
                  }}
                  className="flex items-center gap-2 mt-3.5 pb-2"
                  style={{ borderBottom: '1px solid rgba(232,200,120,0.35)' }}
                >
                  <input
                    id="welcome-chat-input"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type here, or tap the orb and talk"
                    className="flex-1 bg-transparent outline-none font-sans text-[14px]"
                    style={{ color: '#F0EEE8' }}
                    aria-label="Your name"
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
