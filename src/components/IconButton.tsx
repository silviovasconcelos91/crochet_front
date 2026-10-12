import type { ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-xl text-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
