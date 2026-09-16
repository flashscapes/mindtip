import type { Tip } from '@/types'

export function TipCard({
  tip,
  textColor,
  accentColor,
  fontFamily
}: {
  tip: Tip
  textColor?: string
  accentColor?: string
  fontFamily?: string
}) {
  return (
    <div
      className="border-l-2 pl-5 py-1 my-2 max-w-[85%]"
      style={{ borderColor: accentColor ?? '#B8935A' }}
    >
      <p
        className={`text-[20px] leading-snug ${fontFamily ? '' : 'font-display font-light'}`}
        style={{ color: textColor ?? '#0B1414', fontFamily }}
      >
        {tip.headline}
      </p>
      <p className="text-[15px] mt-2" style={{ color: textColor ?? '#0B1414', fontFamily }}>
        {tip.action}
      </p>
      {tip.referencedMemory && (
        <p className="text-[13px] mt-3" style={{ color: textColor ?? '#345350', opacity: 0.75, fontFamily }}>
          Based on what's worked for you before.
        </p>
      )}
    </div>
  )
}
