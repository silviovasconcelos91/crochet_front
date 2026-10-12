import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import { FieldError } from './FieldError'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hideLabel?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ label, error, hideLabel = false, id, className = '', ...rest }: TextAreaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-stone-700'}>
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="field-sizing-content min-h-11 w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none aria-invalid:border-red-500"
        {...rest}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}
