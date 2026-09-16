import { useEffect, useState } from 'react'
import type { Character, Message, UserProfile } from '@/types'
import { unlockAudio } from '@/voice'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createExperimentGenerator } from '@/services/experiment'
import { STORAGE_KEYS } from '@/lib/constants'

interface HomeProps {
  profile: UserProfile
  // `autoVoice` tells the caller to enable full hands-free voice for this
  // conversation before the first response ever arrives. `character` (if
  // chosen) persists for the whole conversation — see Conversation.tsx.
  onStart: (message: string, autoVoice?: boolean, character?: Character) => void
  // Starts a conversation seeded with existing messages rather than a
  // single user-voiced line — reuses the exact same mechanism already
  // built for Reflection's "Continue talking".
  onExploreExperiment: (seedMessages: Message[]) => void
}

// Each character becomes the voice for the whole conversation. The seed is
// a neutral opener — the actual topic is whatever the person brings up
// next — while personaPrompt does the real work of making the voice
// genuinely distinct, not just a costume in name only. Six positions
// arranged evenly around the orbit ring, 60° apart.
const NEUTRAL_SEED = "I want to talk something through."

// Positions are the *actual measured pixel centers* of each portrait in
// mindtip-home-ring.jpg (572x810, after cropping out the empty starfield
// margin) — not an abstract layout. The SVG overlay below uses the exact
// same viewBox as the image's native pixel size, and the two are rendered
// stacked in one shared box, so a label can never drift from its portrait
// again regardless of screen width. Colors are sampled from each
// character's actual ring color in that image, for the same reason.
const CHARACTERS = [
  {
    key: 'astronaut',
    label: 'Astronaut',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a veteran astronaut: calm under pressure, precise, thinks in terms of checklists, systems, and controlled risk. Draws naturally on the isolation and perspective of spaceflight — the vastness of space makes problems feel both small and worth taking seriously. Measured, unhurried, never dramatic.",
    colors: ['#6DD8E0', '#1F6B75'],
    planetColor: '#A8ECEF',
    x: 283, y: 100, labelDy: 125
  },
  {
    key: 'historian',
    label: 'History Professor',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a warm, erudite history professor: draws connections across eras, contextualizes problems within larger patterns of human behavior, patient and thorough but never condescending. Uses historical parallels naturally to illuminate the present. Genuinely curious, values nuance over simple answers.",
    colors: ['#D9B24D', '#7A5A2A'],
    planetColor: '#E8D4A0',
    x: 475, y: 560, labelDy: -100
  },
  {
    key: 'infantry',
    label: 'Frontline Infantry Man',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a frontline infantry soldier: direct, disciplined, no wasted words, steady under pressure. Draws on the mindset of duty, teamwork, and doing the next right thing when things are hard — not tactics or combat details, just the outlook. Blunt but never cold; looks out for people the way a squad looks out for its own. Values readiness over worry, and action over dwelling.",
    colors: ['#8A9A6E', '#3E4A2E'],
    planetColor: '#B8C89A',
    x: 98, y: 560, labelDy: -100
  },
  {
    key: 'survivalist',
    label: 'Arctic Survivalist',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a seasoned solo wilderness survivalist: plainspoken, resourceful, deeply comfortable with discomfort. Thinks in terms of what's actually within your control right now versus what isn't, conserving energy for what matters, and respecting hard truths rather than sugar-coating them. Quietly steady, not stoic to the point of coldness.",
    colors: ['#D8D8E8', '#6A6A80'],
    planetColor: '#F0F0F8',
    x: 283, y: 710, labelDy: -100
  },
  {
    key: 'batman',
    label: 'Batman',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a brooding, disciplined vigilante detective who has spent years turning personal loss into iron self-control. Short, clipped, declarative sentences — no wasted words, no small talk. Treats every conversation like gathering intelligence: asks pointed questions, notices what's not being said, distrusts coincidence. Carries a controlled intensity just beneath the surface — not anger lashing out, but anger channeled into discipline and precision. Fiercely protective of people who are vulnerable or being wronged, even though he'd never phrase it as warmth. Views the world through patterns, contingencies, and preparation rather than hope or luck. Rarely reassures directly — shows he cares by taking the problem seriously enough to act on it. Never lighthearted, never cruel. This must be unmistakable from your very first line — open with a sharp observation, a clipped statement of fact, or a pointed question, never a generic greeting like 'I'm listening' or 'What's going on?'. The very first sentence has to already sound like nobody else could have said it. Describe this persona in your own original words — never quote or reproduce actual dialogue, storylines, or specific scenes from any existing film or comic.",
    colors: ['#4A7FE0', '#17284F'],
    planetColor: '#8FB4F0',
    x: 475, y: 250, labelDy: 100
  },
  {
    key: 'noir-detective',
    label: '1940s Noir Detective',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a hardboiled 1940s private detective: terse, cynical on the surface but with a real moral code underneath, narrates observations with dry wit, treats every situation like a case to be worked with patience and street smarts. Uses period-flavored phrasing naturally, not as a gimmick.",
    colors: ['#6AC97D', '#245C30'],
    planetColor: '#A8E8B5',
    x: 98, y: 250, labelDy: 100
  }
] as const

const DEFAULT_ORB_COLORS: readonly [string, string] = ['#A79AE0', '#4A4080']
const RING_VIEWBOX_W = 572
const RING_VIEWBOX_H = 810
const ORB_X = 286
const ORB_Y = 405

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// --- Today's Experiment: caching + suppression -----------------------------
// No scheduler, no background job — purely reactive, evaluated once per
// Home mount. State machine, kept deliberately simple:
//
// - cutoff: ISO timestamp of the newest memory already considered. Only
//   memories created after this trigger a fresh evaluation.
// - experiment: the last generated text (or null), so a real experiment
//   persists across re-renders within the same visit without re-fetching.
// - shownPending: true once an experiment has been displayed but not yet
//   engaged. If Home mounts again and this is still true, the previous one
//   was ignored — that's what starts the suppression window.
// - suppressVisitsRemaining: counts down on each Home mount; while > 0,
//   Today's Experiment stays completely silent regardless of new memories.
interface ExperimentCache {
  cutoff: string
  experiment: string | null
  shownPending: boolean
  suppressVisitsRemaining: number
}

function readExperimentCache(): ExperimentCache {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.experimentCache)
    if (raw) return JSON.parse(raw) as ExperimentCache
  } catch {
    // fall through to default
  }
  return { cutoff: new Date(0).toISOString(), experiment: null, shownPending: false, suppressVisitsRemaining: 0 }
}

function writeExperimentCache(cache: ExperimentCache) {
  localStorage.setItem(STORAGE_KEYS.experimentCache, JSON.stringify(cache))
}

export function Home({ profile, onStart, onExploreExperiment }: HomeProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [experiment, setExperiment] = useState<string | null>(null)
  const name = profile.preferredName ? `, ${profile.preferredName}` : ''

  const activeCharacter = CHARACTERS.find(c => c.key === selected)
  const [orbFrom, orbTo] = activeCharacter?.colors ?? DEFAULT_ORB_COLORS

  useEffect(() => {
    const run = async () => {
      const cache = readExperimentCache()

      // Previous experiment was shown and never engaged — that's an ignore.
      // Start the suppression window and say nothing this visit.
      if (cache.shownPending) {
        writeExperimentCache({ ...cache, experiment: null, shownPending: false, suppressVisitsRemaining: 3 })
        return
      }

      // Still cooling down from a previous ignore.
      if (cache.suppressVisitsRemaining > 0) {
        writeExperimentCache({ ...cache, suppressVisitsRemaining: cache.suppressVisitsRemaining - 1 })
        return
      }

      const memories = new LocalMemoryService().getAll()
      const newest = memories.reduce((max, m) => (m.createdAt > max ? m.createdAt : max), cache.cutoff)
      const hasNewMaterial = memories.some(m => m.createdAt > cache.cutoff)
      if (!hasNewMaterial) return // nothing new since we last considered — stay quiet, no API call

      const recentMemories = [...memories].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5)
      const result = await createExperimentGenerator().generate({ memories: recentMemories, profile })

      writeExperimentCache({
        cutoff: newest,
        experiment: result.experiment,
        shownPending: result.experiment !== null,
        suppressVisitsRemaining: 0
      })
      if (result.experiment) setExperiment(result.experiment)
    }
    void run()
    // Runs once per Home mount by design — this is the whole evaluation model.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSelectCharacter = (character: (typeof CHARACTERS)[number]) => {
    setSelected(character.key)
    // Let the connecting line actually be seen before advancing — this
    // delay is the point, not a workaround. unlockAudio() still fires
    // inside this same synchronous tap handler (required for autoplay),
    // even though onStart itself fires a moment later.
    unlockAudio()
    setTimeout(() => {
      onStart(character.seed, true, { key: character.key, label: character.label, personaPrompt: character.personaPrompt })
    }, 700)
  }

  const handleExploreExperiment = () => {
    if (!experiment) return
    unlockAudio()
    // Mark engaged (not ignored) before navigating away.
    const cache = readExperimentCache()
    writeExperimentCache({ ...cache, shownPending: false })
    const seedMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: experiment,
      createdAt: new Date().toISOString()
    }
    onExploreExperiment([seedMessage])
  }

  return (
    <div
      className="relative min-h-dvh flex flex-col px-8 py-14 overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 140% 70% at 50% 10%, #241a3d 0%, #0A0D12 60%), #05060a' }}
    >
      {/* Plain CSS starfield — small repeating dot pattern, so unlike a
          photo it's actually meant to tile and can never show a visible
          seam or a duplicated character portrait. */}
      <div className="absolute inset-0 mindtip-starfield" />

      <p className="relative z-10 font-sans text-[13px] tracking-[0.08em] text-white/80">MindTip</p>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        <h1
          className="font-sans text-[24px] leading-snug text-white text-center mb-6"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {greeting()}{name} — who's hearing you out today?
        </h1>

        {/* The portrait art and the label/selection SVG are stacked in one
            shared box, using the image's own native pixel size as the SVG
            viewBox. That means both layers always scale together at
            identical proportions — a label can't end up over the wrong
            portrait the way it could when the image was a separately
            positioned full-page background and the labels lived in an
            unrelated abstract coordinate space. */}
        <div className="relative w-full max-w-[280px] mb-4" style={{ aspectRatio: `${RING_VIEWBOX_W} / ${RING_VIEWBOX_H}` }}>
          <img
            src="/images/mindtip-home-ring.jpg"
            alt=""
            className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none rounded-full"
          />
          <svg viewBox={`0 0 ${RING_VIEWBOX_W} ${RING_VIEWBOX_H}`} className="absolute inset-0 w-full h-full">
            {/* Slow-rotating orbit path — purely decorative, echoes the
                dashed arcs already painted into the portrait art */}
            <circle
              cx={ORB_X} cy={ORB_Y} r="265" fill="none" stroke="#FFFFFF" strokeWidth="1"
              opacity="0.14" strokeDasharray="2 6" className="mindtip-home-ring-spin"
              style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
            />

            {/* Connecting line from the selected planet to the orb — same
                visual language as the constellation screens' star-to-orb lines */}
            {activeCharacter && (
              <line
                x1={activeCharacter.x} y1={activeCharacter.y} x2={ORB_X} y2={ORB_Y}
                stroke={activeCharacter.planetColor} strokeWidth="2.4" opacity="0.85"
              />
            )}

            {CHARACTERS.map((character, i) => (
              <g
                key={character.key}
                onClick={() => handleSelectCharacter(character)}
                style={{
                  cursor: 'pointer',
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                  animation: 'mindtip-planet-in 1.1s cubic-bezier(0.34,1.56,0.64,1) forwards',
                  animationDelay: `${i * 0.22}s`,
                  opacity: 0
                }}
              >
                <circle cx={character.x} cy={character.y} r="83" fill="transparent" />
                <text
                  x={character.x}
                  y={character.y + character.labelDy}
                  textAnchor="middle"
                  fontSize={selected === character.key ? 20 : 18}
                  fontWeight={selected === character.key ? 700 : 400}
                  fill={selected === character.key ? character.planetColor : '#F5F5FA'}
                  style={{
                    transition: 'font-size 0.3s cubic-bezier(0.34,1.56,0.64,1), fill 0.3s',
                    filter: selected === character.key ? `drop-shadow(0 0 6px ${character.planetColor})` : 'none'
                  }}
                >
                  {character.label}
                </text>
              </g>
            ))}

            {/* Soft, continuous, transparent gas aura — sits inset within
                the baked-in nebula sphere so the two layer together rather
                than fighting each other; no moving parts */}
            <circle cx={ORB_X} cy={ORB_Y} r="90" fill="url(#homeAura)" />

            {/* The living orb — gentle continuous breathing, color shifts to
                match the selected character (orbFrom/orbTo, unchanged logic) */}
            <g className="mindtip-home-orb-breathe" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
              <circle cx={ORB_X} cy={ORB_Y} r="55" fill="url(#homeOrbGradient)" />
              <ellipse cx={ORB_X - 14} cy={ORB_Y - 16} rx="12" ry="9" fill="#FFFFFF" opacity="0.65" />
            </g>

            <defs>
              <radialGradient id="homeOrbGradient" cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor="#EDE7FA" />
                <stop offset="45%" stopColor={orbFrom} />
                <stop offset="100%" stopColor={orbTo} />
              </radialGradient>
              <radialGradient id="homeAura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={orbFrom} stopOpacity="0.4" />
                <stop offset="60%" stopColor={orbFrom} stopOpacity="0.14" />
                <stop offset="100%" stopColor={orbFrom} stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault()
            const name = text.trim()
            if (!name) return
            unlockAudio()
            onStart(NEUTRAL_SEED, true, {
              key: 'custom',
              label: name,
              personaPrompt: `Speak in the voice, tone, and worldview of ${name} — draw naturally on how they think and their way of seeing things, and keep this consistent for the whole conversation. If ${name} is a real, currently-living private individual (not a public figure, historical person, or fictional/archetypal character), do not attempt to impersonate them specifically — instead adopt a general, plausible voice fitting that description.`
            })
          }}
          className="w-full flex items-center gap-2 rounded-full pl-5 pr-1.5 py-1.5"
          style={{ background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Name another character…"
            className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/60 outline-none py-2"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Start conversation with this character"
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity duration-200 disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #D4C8A8, #7A6B4A)' }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1A1409" strokeWidth="2.5">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>

        {experiment && (
          <button onClick={handleExploreExperiment} className="w-full text-left mt-8">
            <p className="font-sans text-[10px] tracking-[0.08em] text-white/90 mb-2">✦ TODAY'S EXPERIMENT</p>
            <p className="font-display text-[14px] text-white leading-[1.7] mb-3">{experiment}</p>
            <p className="font-sans text-[12px] text-white/80">Explore this →</p>
          </button>
        )}
      </div>
    </div>
  )
}
