export type ProgressStatus = 'IN_PROGRESS' | 'FINISHED'

export interface Account {
  id: number
  username: string
  email: string
  createdAt: string
}

export interface Row {
  number: string
  value: string
}

export interface Step {
  title: string
  rows: Row[]
}

export interface Position {
  stepIndex: number
  rowIndex: number
}

export interface Progress extends Position {
  status: ProgressStatus
  startedAt: string
  updatedAt: string
  finishedAt: string | null
}

export interface Pattern {
  id: number
  title: string
  description: string | null
  hookSizeMm: number | null
  yarn: string | null
  sourceUrl: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  steps: Step[]
  progress: Progress | null
}

export interface PatternSummary {
  id: number
  title: string
  description: string | null
  hookSizeMm: number | null
  yarn: string | null
  imageUrl: string | null
  stepCount: number
  progress: Progress | null
}

export interface PatternInput {
  title: string
  description?: string | null
  hookSizeMm?: number | null
  yarn?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
  steps: { title: string; rows: { number: string; value: string }[] }[]
}

export interface ProgressInput extends Position {
  status: ProgressStatus
}

export interface ApiFieldError {
  field: string
  message: string
}

export interface Problem {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  errors?: ApiFieldError[]
}
