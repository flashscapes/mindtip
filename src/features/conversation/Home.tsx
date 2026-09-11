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
    colors: ['#8FE0D0', '#4FAE9E']
  },
  {
    key: 'focus',
    label: 'Focus',
    seed: "I'm having trouble focusing and want some clarity.",
    colors: ['#9AC4CC', '#3D7A85']
  },
  {
    key: 'balance',
    label: 'Balance',
    seed: "I've been feeling pulled in a lot of directions and want some balance.",
    colors: ['#E3CFA0', '#B8935A']
  },
  {
    key: 'energy',
    label: 'Energy',
    seed: "I want to explore what's giving me energy, or taking it, right now.",
    colors: ['#E3EDA0', '#9BCB74']
  }
] as const

const DEFAULT_ORB_COLORS: readonly [string, string] = ['#9AD9CC', '#4FAE9E']

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
    <div className="relative min-h-dvh flex flex-col px-8 py-14 overflow-hidden bg-gradient-to-br from-[#E9F5F3] via-[#DCEFEC] to-[#CFEAE5]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-20 w-80 h-80 rounded-full bg-[#7FCFC0] opacity-30 blur-3xl" />
        <div className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-[#B8935A] opacity-20 blur-3xl" />
        <div className="absolute -bottom-32 left-1/4 w-96 h-96 rounded-full bg-[#4FAE9E] opacity-25 blur-3xl" />
      </div>

      <p className="relative z-10 font-sans text-[13px] tracking-[0.08em] text-mist">MindTip</p>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm mx-auto">
        <h1 className="font-display font-light text-[26px] leading-snug text-ivory text-center mb-10">
          What shall we explore today{name}?
        </h1>

        <div className="relative w-40 h-40 mb-10">
          {/* Mist halo — orbits slowly around the orb, colored to match the
              currently selected intention (reuses orbFrom/orbTo directly,
              so it updates automatically with no separate logic). */}
          <div className="absolute inset-0 mindtip-mist-spin">
            <div className="absolute rounded-full" style={{ width: 44, height: 44, top: -6, left: '50%', marginLeft: -22, background: orbFrom, opacity: 0.35, filter: 'blur(18px)' }} />
            <div className="absolute rounded-full" style={{ width: 40, height: 40, bottom: 4, left: 8, background: orbTo, opacity: 0.3, filter: 'blur(18px)' }} />
            <div className="absolute rounded-full" style={{ width: 40, height: 40, bottom: 0, right: 4, background: orbFrom, opacity: 0.3, filter: 'blur(18px)' }} />
          </div>

          {/* The orb itself — heartbeat pulse (unchanged), plus layered
              inset shadows for real dimensionality instead of a flat fill. */}
          <div
            className="mindtip-orb absolute top-1/2 left-1/2 -mt-16 -ml-16 w-32 h-32 rounded-full overflow-hidden transition-all duration-700"
            style={{
              background: `radial-gradient(circle at 35% 30%, ${orbFrom}, ${orbTo})`,
              boxShadow: '0 20px 50px -15px rgba(37,56,58,0.35), inset -10px -12px 22px rgba(0,0,0,0.18), inset 8px 10px 18px rgba(255,255,255,0.22)'
            }}
          >
            {/* Slowly rotating inner highlight — off-center, so rotating it
                visibly circulates within the sphere, suggesting something
                alive moving inside rather than a static fill. */}
            <div
              className="absolute inset-0 mindtip-orb-swirl"
              style={{ background: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.45), transparent 60%)' }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 w-full mb-6">
          {INTENTIONS.map(intention => (
            <button
              key={intention.key}
              onClick={() => setSelected(intention.key)}
              className={`rounded-2xl py-6 text-center border transition-all duration-300 ${
                selected === intention.key
                  ? 'bg-white/60 border-bronze shadow-md'
                  : 'bg-white/35 border-white/50 hover:bg-white/45'
              }`}
            >
              <span className="font-sans text-[15px] text-ivory">{intention.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={handleExplore}
          disabled={!activeIntention}
          className="w-full bg-gradient-to-r from-[#B8935A] to-[#A5804B] text-white font-sans text-[15px] font-medium py-4 rounded-full shadow-[0_10px_30px_-8px_rgba(184,147,90,0.6)] disabled:opacity-40 disabled:shadow-none transition-all duration-300 mb-8"
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
            className="w-full bg-transparent text-[15px] text-ivory placeholder:text-mist/70 outline-none pb-3 text-center focus:border-bronze transition-colors duration-300"
            style={{ borderBottom: '1px solid rgba(37,56,58,0.14)' }}
          />
        </form>

        {experiment && (
          <button onClick={handleExploreExperiment} className="w-full text-left mt-8">
            <p className="font-sans text-[10px] tracking-[0.08em] text-bronze mb-2">✦ TODAY'S EXPERIMENT</p>
            <p className="font-display text-[14px] text-ivory leading-[1.7] mb-3">{experiment}</p>
            <p className="font-sans text-[12px] text-bronze">Explore this →</p>
          </button>
        )}
      </div>
    </div>
  )
}
