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

const CHARACTERS = [
  {
    key: 'astronaut',
    label: 'Astronaut',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a veteran astronaut: calm under pressure, precise, thinks in terms of checklists, systems, and controlled risk. Draws naturally on the isolation and perspective of spaceflight — the vastness of space makes problems feel both small and worth taking seriously. Measured, unhurried, never dramatic.",
    colors: ['#9AC4CC', '#3D7A85'],
    planetColor: '#CFE0F5',
    x: 150, y: 50, labelDy: -18
  },
  {
    key: 'historian',
    label: 'History Professor',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a warm, erudite history professor: draws connections across eras, contextualizes problems within larger patterns of human behavior, patient and thorough but never condescending. Uses historical parallels naturally to illuminate the present. Genuinely curious, values nuance over simple answers.",
    colors: ['#C9A876', '#7A5A2A'],
    planetColor: '#E8D4A0',
    x: 236, y: 100, labelDy: -14
  },
  {
    key: 'comedian',
    label: 'Irreverent Comedian',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a sharp, irreverent stand-up comedian: quick, observational, cuts through self-seriousness with humor, but underneath the jokes is real insight — comedians often see uncomfortable truths clearly precisely because they're willing to say them out loud. Never mean-spirited, always a little playful.",
    colors: ['#F0A0A0', '#B85A5A'],
    planetColor: '#F0B8B8',
    x: 236, y: 200, labelDy: 22
  },
  {
    key: 'survivalist',
    label: 'Arctic Survivalist',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a seasoned solo wilderness survivalist: plainspoken, resourceful, deeply comfortable with discomfort. Thinks in terms of what's actually within your control right now versus what isn't, conserving energy for what matters, and respecting hard truths rather than sugar-coating them. Quietly steady, not stoic to the point of coldness.",
    colors: ['#E3EDA0', '#9BCB74'],
    planetColor: '#CFF5E0',
    x: 150, y: 250, labelDy: 22
  },
  {
    key: 'batman',
    label: 'Batman',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a brooding, disciplined vigilante detective: terse, methodical, thinks several steps ahead, treats every problem as something to be investigated and solved through discipline and preparation rather than luck. Carries real weight and seriousness, rarely lighthearted, but never cruel. Describe this persona in your own original words — never quote or reproduce actual dialogue, storylines, or specific scenes from any existing film or comic.",
    colors: ['#5A6B8A', '#1A2438'],
    planetColor: '#A0AEC8',
    x: 63, y: 200, labelDy: 22
  },
  {
    key: 'noir-detective',
    label: '1940s Noir Detective',
    seed: NEUTRAL_SEED,
    personaPrompt: "Speak like a hardboiled 1940s private detective: terse, cynical on the surface but with a real moral code underneath, narrates observations with dry wit, treats every situation like a case to be worked with patience and street smarts. Uses period-flavored phrasing naturally, not as a gimmick.",
    colors: ['#B8AC94', '#5A5040'],
    planetColor: '#D4C8A8',
    x: 63, y: 100, labelDy: -14
  }
] as const

const DEFAULT_ORB_COLORS: readonly [string, string] = ['#A79AE0', '#4A4080']
const ORB_X = 150
const ORB_Y = 150

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

  const handleExplore = () => {
    if (!activeCharacter) return
    // Must be called synchronously inside this real tap to satisfy the
    // browser's autoplay policy — see the same pattern previously used for
    // the mood check-in submit.
    unlockAudio()
    onStart(activeCharacter.seed, true, { key: activeCharacter.key, label: activeCharacter.label, personaPrompt: activeCharacter.personaPrompt })
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
      className="relative min-h-dvh flex flex-col px-8 py-14 overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: "url('/images/mindtip-home.jpg')" }}
    >
      {/* Readability wash over the photo — content stays legible without hiding the image */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, rgba(5,5,10,0.55), rgba(5,5,10,0.15) 30%, rgba(5,5,10,0.15) 70%, rgba(5,5,10,0.6))' }}
      />

      <p className="relative z-10 font-sans text-[13px] tracking-[0.08em] text-white/80">MindTip</p>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        <h1
          className="font-sans text-[24px] leading-snug text-white text-center mb-6"
          style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.04em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}
        >
          {greeting()}{name} — who's hearing you out today?
        </h1>

        {/* Orb + four intentions orbiting it, in place of a grid of buttons.
            Same underlying selection state as before (setSelected/onStart) —
            only the presentation changed. */}
        <svg viewBox="0 0 300 300" className="w-full max-w-[280px] mb-4">
          {/* Slow-rotating orbit path — purely decorative */}
          <circle
            cx={ORB_X} cy={ORB_Y} r="100" fill="none" stroke="#FFFFFF" strokeWidth="1"
            opacity="0.18" strokeDasharray="2 6" className="mindtip-home-ring-spin"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />

          {/* Connecting line from the selected planet to the orb — same
              visual language as the constellation screens' star-to-orb lines */}
          {activeCharacter && (
            <line
              x1={activeCharacter.x} y1={activeCharacter.y} x2={ORB_X} y2={ORB_Y}
              stroke={activeCharacter.planetColor} strokeWidth="1.8" opacity="0.85"
            />
          )}

          {CHARACTERS.map((character, i) => (
            <g
              key={character.key}
              onClick={() => setSelected(character.key)}
              style={{
                cursor: 'pointer',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: 'mindtip-planet-in 1.1s cubic-bezier(0.34,1.56,0.64,1) forwards',
                animationDelay: `${i * 0.22}s`,
                opacity: 0
              }}
            >
              <circle cx={character.x} cy={character.y} r="24" fill="transparent" />
              <circle
                cx={character.x} cy={character.y}
                r={selected === character.key ? 11 : 9}
                fill={character.planetColor}
                opacity={selected === character.key ? 1 : 0.9}
                style={{ transition: 'r 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
              />
              <text x={character.x} y={character.y + character.labelDy} textAnchor="middle" fontSize="13" fill="#F5F5FA">
                {character.label}
              </text>
            </g>
          ))}

          {/* Soft, continuous, transparent gas aura — no moving parts */}
          <circle cx={ORB_X} cy={ORB_Y} r="50" fill="url(#homeAura)" />

          {/* The living orb — gentle continuous breathing, color shifts to
              match the selected intention (orbFrom/orbTo, unchanged logic) */}
          <g className="mindtip-home-orb-breathe" style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            <circle cx={ORB_X} cy={ORB_Y} r="30" fill="url(#homeOrbGradient)" />
            <ellipse cx={ORB_X - 10} cy={ORB_Y - 12} rx="7" ry="5" fill="#FFFFFF" opacity="0.65" />
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

        <button
          onClick={handleExplore}
          disabled={!activeCharacter}
          className="w-full bg-white/90 text-[#3F5C9E] font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(0,0,0,0.3)] disabled:opacity-40 disabled:shadow-none transition-all duration-300 mb-8"
        >
          Explore
        </button>

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
          className="w-full"
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Name another character…"
            className="w-full bg-transparent text-[15px] text-white placeholder:text-white/60 outline-none pb-3 text-center focus:border-white/60 transition-colors duration-300"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}
          />
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
