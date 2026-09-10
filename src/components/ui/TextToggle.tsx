interface TextToggleProps {
  label: string
  selected?: boolean
  onClick?: () => void
}

// A word that can be toggled on/off — used for multi-select onboarding
// questions in place of chip/pill UI. No border, no fill; selection is
// carried entirely by color and a thin underline.
export function TextToggle({ label, selected, onClick }: TextToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[17px] transition-colors duration-300 ${
        selected ? 'text-bronze underline underline-offset-4 decoration-1' : 'text-ivory hover:text-bronze'
      }`}
    >
      {label}
    </button>
  )
}
