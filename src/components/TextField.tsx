import { useId, type InputHTMLAttributes, type Ref } from 'react'
import { FieldError } from './FieldError'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  hideLabel?: boolean
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, error, hint, hideLabel = false, id, className = '', ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-stone-700'}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none aria-invalid:border-red-500"
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
