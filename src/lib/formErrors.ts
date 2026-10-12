import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiError } from '../api/client'
import type { ApiFieldError } from '../api/types'
import { errorMessage, translateServerMessage } from './errors'

/** "steps[0].rows[1].value" (Spring) → "steps.0.rows.1.value" (react-hook-form). */
export function toFormPath(serverPath: string): string {
  return serverPath.replace(/\[(\d+)\]/g, '.$1')
}

function valueAt(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

/** Un champ « connu » est une feuille du formulaire (texte/nombre/null), pas un tableau ni un objet. */
export function splitFieldErrors(errors: ApiFieldError[], values: unknown) {
  const fields: { path: string; message: string }[] = []
  const others: ApiFieldError[] = []
  for (const error of errors) {
    const path = toFormPath(error.field)
    const value = valueAt(values, path)
    if (value !== undefined && (value === null || typeof value !== 'object')) fields.push({ path, message: error.message })
    else others.push(error)
  }
  return { fields, others }
}

export function firstErrorPath(errors: unknown, prefix = ''): string | null {
  if (errors === null || typeof errors !== 'object') return null
  if ('type' in errors && typeof (errors as { type: unknown }).type === 'string') return prefix || null
  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref') continue
    const found = firstErrorPath(value, prefix ? `${prefix}.${key}` : key)
    if (found) return found
  }
  return null
}

type FocusableForm<T extends FieldValues> = Pick<UseFormReturn<T>, 'formState' | 'setFocus'>
export type ServerErrorForm<T extends FieldValues> = FocusableForm<T> & Pick<UseFormReturn<T>, 'setError' | 'getValues'>

/** Après rendu (étapes repliées dépliées), focus et défilement sur le premier champ en erreur. */
export function scheduleFocusFirstError<T extends FieldValues>(form: FocusableForm<T>): void {
  setTimeout(() => {
    const path = firstErrorPath(form.formState.errors)
    if (path) form.setFocus(path as Path<T>)
  }, 0)
}

export function applyServerErrors<T extends FieldValues>(error: unknown, form: ServerErrorForm<T>): string | null {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) return errorMessage(error)
  const { fields, others } = splitFieldErrors(error.fieldErrors, form.getValues())
  for (const field of fields) {
    form.setError(field.path as Path<T>, { type: 'server', message: translateServerMessage(field.message) })
  }
  if (fields.length > 0) scheduleFocusFirstError(form)
  return others.length > 0 ? others.map((other) => translateServerMessage(other.message)).join(' · ') : null
}
