import { useEffect, useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { LocalMemoryService } from '@/services/memory/MemoryService'
import { createReflectionGenerator, type ReflectionResult } from '@/services/reflection'
import { tapHaptic } from '@/lib/haptics'

interface ReflectionProps {
  messages: Message[]
  profile: UserProfile
  // Returns to Conversation with the full prior history intact, plus the
  // reflection itself appended as a real message — so if the person
  // pushes back on it, MindTip has full context rather than starting over.
  onContinueTalking: (seedMessages: Message[]) => void
  onExit: () => void
}

export function Reflection({ messages, profile, onContinueTalking, onExit }: ReflectionProps) {
  const [result, setResult] = useState<ReflectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openNode, setOpenNode] = useState<'patterns' | 'anchoring' | 'insights' | null>(null)

  useEffect(() => {
    let cancelled = false
    const generator = createReflectionGenerator()

    // Reuses the same relevance method every regular chat turn already
    // uses (whole-word overlap, no forced quota — returns fewer than the
    // limit, or none, when that's all that's genuinely relevant) instead
    // of the previous top-5-by-confidence approach, which ignored whether
    // a memory had anything to do with this conversation at all.
    //
    // Query is built from only the user's own messages, not the
    // assistant's replies — otherwise MindTip's own prior wording would
    // disproportionately shape which memories get pulled back in.
    const userContent = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join(' ')
    const relevantMemories = new LocalMemoryService().getRelevant(userContent, 5)

    generator
      .generate({ messages, profile, relevantMemories })
      .then(r => {
        if (!cancelled) setResult(r)
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
    // Runs once on mount with the transcript this screen was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nodes = result
    ? ([
        { key: 'patterns', label: 'Patterns', content: result.patterns },
        { key: 'anchoring', label: 'Anchoring', content: result.anchoring },
        { key: 'insights', label: 'Insights', content: result.insights }
      ] as const)
    : []

  const handleContinueTalking = () => {
    if (!result) return
    const reflectionMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: result.reflection,
      createdAt: new Date().toISOString()
    }
    onContinueTalking([...messages, reflectionMessage])
  }

  return (
    <div className="relative min-h-dvh flex flex-col px-6 py-10 overflow-hidden bg-gradient-to-br from-[#EAF3EE] via-[#E4EEE8] to-[#F1E9DD]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -left-16 w-72 h-72 rounded-full bg-[#B8935A] opacity-20 blur-3xl" />
        <div className="absolute -bottom-28 -right-16 w-80 h-80 rounded-full bg-[#7FCFC0] opacity-30 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-sm w-full mx-auto flex-1 flex flex-col">
        <p className="font-sans text-[11px] tracking-[0.08em] text-mist mb-6">TODAY'S CORE REFLECTION</p>

        {!result && !error && (
          <div className="bg-white/92 backdrop-blur-xl border border-white/95 rounded-[28px] px-7 py-10 shadow-[0_16px_40px_-14px_rgba(37,56,58,0.28)]">
            <p className="font-display font-light text-[17px] text-mist italic">Sitting with what came up…</p>
          </div>
        )}

        {error && (
          <div className="bg-white/92 backdrop-blur-xl border border-white/95 rounded-[28px] px-7 py-10 shadow-[0_16px_40px_-14px_rgba(37,56,58,0.28)]">
            <p className="font-sans text-[14px] text-ivory">MindTip hit a snag putting the reflection together.</p>
            <p className="font-sans text-[12px] text-mist mt-2">{error}</p>
          </div>
        )}

        {result && (
          <>
            <div className="bg-white/92 backdrop-blur-xl border border-white/95 rounded-[28px] px-7 py-8 shadow-[0_16px_40px_-14px_rgba(37,56,58,0.28)]">
              <p className="font-display font-light text-[19px] leading-relaxed text-ivory">{result.reflection}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {nodes.map(node => (
                <div key={node.key} className="bg-white/85 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => { tapHaptic(); setOpenNode(openNode === node.key ? null : node.key) }}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="font-sans text-[14px] text-ivory">{node.label}</span>
                    <span className="text-mist text-[13px]">{openNode === node.key ? '−' : '→'}</span>
                  </button>
                  {openNode === node.key && (
                    <p className="font-sans text-[13px] text-mist leading-relaxed px-5 pb-4">{node.content}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex-1" />

        <div className="text-center pb-4">
          {result && (
            <>
              <p className="font-sans text-[13px] text-mist mb-3">What part of this should we explore further?</p>
              <button onClick={handleContinueTalking} className="font-sans text-[14px] text-bronze hover:opacity-80 transition-opacity duration-300">
                Continue talking
              </button>
            </>
          )}
          <div className="mt-4">
            <button onClick={onExit} className="font-sans text-[13px] text-mist hover:text-bronze transition-colors duration-300">
              Done for now
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
