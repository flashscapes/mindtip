import type { Tip } from '@/types'

export function TipCard({ tip }: { tip: Tip }) {
  return (
    <div className="border-l-2 border-bronze pl-5 py-1 my-2 max-w-[85%]">
      <p className="font-display font-light text-[20px] text-ivory leading-snug">{tip.headline}</p>
      <p className="text-ivory text-[15px] mt-2">{tip.action}</p>
      {tip.referencedMemory && (
        <p className="text-[13px] text-mist mt-3">Based on what's worked for you before.</p>
      )}
    </div>
  )
}
