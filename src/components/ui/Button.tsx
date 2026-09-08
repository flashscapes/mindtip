import type { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
}

// Every button in MindTip is plain text — no fills, no borders, no radius.
// 'primary' carries the accent color; 'ghost' is for secondary actions
// like Back. Consistent with the zero-chrome treatment on Home/Welcome.
export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base = 'text-[15px] font-normal transition-colors duration-300 disabled:opacity-30'
  const styles = variant === 'primary' ? 'text-bronze hover:opacity-80' : 'text-ivory hover:text-bronze'
  return <button className={`${base} ${styles} ${className}`} {...props} />
}
