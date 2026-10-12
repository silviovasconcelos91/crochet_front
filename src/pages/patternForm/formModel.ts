import type { Pattern, PatternInput } from '../../api/types'

export interface RowValues {
  number: string
  value: string
}

export interface StepValues {
  title: string
  rows: RowValues[]
}

export interface PatternFormValues {
  title: string
  description: string
  hookSizeMm: string
  yarn: string
  sourceUrl: string
  imageUrl: string
  steps: StepValues[]
}

export const emptyRow = (number = ''): RowValues => ({ number, value: '' })
export const emptyStep = (): StepValues => ({ title: '', rows: [emptyRow()] })
export const emptyForm = (): PatternFormValues => ({
  title: '',
  description: '',
  hookSizeMm: '',
  yarn: '',
  sourceUrl: '',
  imageUrl: '',
  steps: [emptyStep()],
})

export function toFormValues(pattern: Pattern): PatternFormValues {
  return {
    title: pattern.title,
    description: pattern.description ?? '',
    hookSizeMm: pattern.hookSizeMm === null ? '' : String(pattern.hookSizeMm).replace('.', ','),
    yarn: pattern.yarn ?? '',
    sourceUrl: pattern.sourceUrl ?? '',
    imageUrl: pattern.imageUrl ?? '',
    steps: pattern.steps.map((step) => ({
      title: step.title,
      rows: step.rows.map((row) => ({ number: row.number, value: row.value })),
    })),
  }
}

const normalizeDecimal = (raw: string) => raw.trim().replace(',', '.')

export function parseHookSize(raw: string): number | null {
  const value = normalizeDecimal(raw)
  return value === '' ? null : Number(value)
}

export function validateHookSize(raw: string): true | string {
  const value = normalizeDecimal(raw)
  if (value === '') return true
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(value)) return 'Nombre positif, 2 décimales max (ex : 3,5)'
  if (Number(value) <= 0) return 'Doit être supérieur à 0'
  return true
}

const optional = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function toPatternInput(values: PatternFormValues): PatternInput {
  return {
    title: values.title.trim(),
    description: optional(values.description),
    hookSizeMm: parseHookSize(values.hookSizeMm),
    yarn: optional(values.yarn),
    sourceUrl: optional(values.sourceUrl),
    imageUrl: optional(values.imageUrl),
    steps: values.steps.map((step) => ({
      title: step.title.trim(),
      rows: step.rows.map((row) => ({ number: row.number.trim(), value: row.value.trim() })),
    })),
  }
}
