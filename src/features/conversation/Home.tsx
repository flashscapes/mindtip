import { useEffect, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { unlockAudio } from '@/voice'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createExperimentGenerator } from '@/services/experiment'
import { STORAGE_KEYS } from '@/lib/constants'

interface HomeProps {
  profile: UserProfile
  // `autoVoice` tells the caller to enable full hands-free voice for this
  // conversation before the first response ever arrives.
  onStart: (message: string, autoVoice?: boolean) => void
  // Starts a conversation seeded with existing messages rather than a
  // single user-voiced line — reuses the exact same mechanism already
  // built for Reflection's "Continue talking".
  onExploreExperiment: (seedMessages: Message[]) => void
}

// Each intention becomes the opening line of the conversation, written as
// something the person would actually say — not a canned line from MindTip.
// The AI generates its own genuine first reply from this, informed by a
// small, generic instruction in the system prompt: the intention is a
// starting lens, not a script or a separate mode.
const INTENTIONS = [
  {
    key: 'calm',
    label: 'Calm',
    seed: "I want to find a little calm today.",
    colors: ['#8FE0D0', '#4FAE9E'],
    planetColor: '#CFE0F5',
    // top / right / bottom / left around the orb
    x: 150, y: 50, labelDy: -18
  },
  {
    key: 'focus',
    label: 'Focus',
    seed: "I'm having trouble focusing and want some clarity.",
    colors: ['#9AC4CC', '#3D7A85'],
    planetColor: '#E0CFF5',
    x: 250, y: 150, labelDy: 4
  },
  {
    key: 'balance',
    label: 'Balance',
    seed: "I've been feeling pulled in a lot of directions and want some balance.",
    colors: ['#E3CFA0', '#B8935A'],
    planetColor: '#F5E0CF',
    x: 150, y: 250, labelDy: 22
  },
  {
    key: 'energy',
    label: 'Energy',
    seed: "I want to explore what's giving me energy, or taking it, right now.",
    colors: ['#E3EDA0', '#9BCB74'],
    planetColor: '#CFF5E0',
    x: 50, y: 150, labelDy: 4
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

  const activeIntention = INTENTIONS.find(i => i.key === selected)
  const [orbFrom, orbTo] = activeIntention?.colors ?? DEFAULT_ORB_COLORS

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
    if (!activeIntention) return
    // Must be called synchronously inside this real tap to satisfy the
    // browser's autoplay policy — see the same pattern previously used for
    // the mood check-in submit.
    unlockAudio()
    onStart(activeIntention.seed, true)
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
      style={{
        background: [
          'radial-gradient(circle at 75% 15%, rgba(150,220,190,0.35), transparent 45%)',
          'radial-gradient(circle at 20% 85%, rgba(120,150,230,0.3), transparent 50%)',
          'linear-gradient(135deg, #3F5C9E 0%, #6455A8 30%, #8A4F9C 55%, #4F9C82 100%)'
        ].join(', ')
      }}
    >
      <p className="relative z-10 font-sans text-[13px] tracking-[0.08em] text-white/80">MindTip</p>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        <h1
          className="font-display font-light text-[22px] leading-snug text-white text-center mb-6"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}
        >
          {greeting()}{name} — how are you feeling?
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
          {activeIntention && (
            <line
              x1={activeIntention.x} y1={activeIntention.y} x2={ORB_X} y2={ORB_Y}
              stroke={activeIntention.planetColor} strokeWidth="1.8" opacity="0.85"
            />
          )}

          {INTENTIONS.map((intention, i) => (
            <g
              key={intention.key}
              onClick={() => setSelected(intention.key)}
              style={{
                cursor: 'pointer',
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: 'mindtip-planet-in 1.1s cubic-bezier(0.34,1.56,0.64,1) forwards',
                animationDelay: `${i * 0.22}s`,
                opacity: 0
              }}
            >
              <circle cx={intention.x} cy={intention.y} r="24" fill="transparent" />
              <circle
                cx={intention.x} cy={intention.y}
                r={selected === intention.key ? 11 : 9}
                fill={intention.planetColor}
                opacity={selected === intention.key ? 1 : 0.9}
                style={{ transition: 'r 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
              />
              <text x={intention.x} y={intention.y + intention.labelDy} textAnchor="middle" fontSize="13" fill="#F5F5FA">
                {intention.label}
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
          disabled={!activeIntention}
          className="w-full bg-white/90 text-[#3F5C9E] font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(0,0,0,0.3)] disabled:opacity-40 disabled:shadow-none transition-all duration-300 mb-8"
        >
          Explore
        </button>

        <form
          onSubmit={e => {
            e.preventDefault()
            if (text.trim()) onStart(text.trim())
          }}
          className="w-full"
        >
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Or tell me what's on your mind…"
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
