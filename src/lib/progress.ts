import type { Position, Progress, ProgressInput, Step } from '../api/types'

export function nextPosition(steps: Step[], pos: Position): Position | null {
  const step = steps[pos.stepIndex]
  if (!step) return null
  if (pos.rowIndex + 1 < step.rows.length) return { stepIndex: pos.stepIndex, rowIndex: pos.rowIndex + 1 }
  if (pos.stepIndex + 1 < steps.length) return { stepIndex: pos.stepIndex + 1, rowIndex: 0 }
  return null
}

export function prevPosition(steps: Step[], pos: Position): Position | null {
  if (pos.rowIndex > 0) return { stepIndex: pos.stepIndex, rowIndex: pos.rowIndex - 1 }
  const previous = steps[pos.stepIndex - 1]
  if (!previous) return null
  return { stepIndex: pos.stepIndex - 1, rowIndex: previous.rows.length - 1 }
}

export const isFirstRow = (steps: Step[], pos: Position): boolean => prevPosition(steps, pos) === null
export const isLastRow = (steps: Step[], pos: Position): boolean => nextPosition(steps, pos) === null

export type RowState = 'past' | 'current' | 'future'

export function compareToCurrent(stepIndex: number, rowIndex: number, progress: Progress | null): RowState {
  if (!progress) return 'future'
  if (stepIndex !== progress.stepIndex) return stepIndex < progress.stepIndex ? 'past' : 'future'
  if (rowIndex === progress.rowIndex) return 'current'
  return rowIndex < progress.rowIndex ? 'past' : 'future'
}

export type PatternState = 'not-started' | 'in-progress' | 'finished'

export function patternState(progress: Progress | null): PatternState {
  if (!progress) return 'not-started'
  return progress.status === 'FINISHED' ? 'finished' : 'in-progress'
}

export function optimisticProgress(
  previous: Progress | null,
  input: ProgressInput,
  now: string = new Date().toISOString(),
): Progress {
  return {
    status: input.status,
    stepIndex: input.stepIndex,
    rowIndex: input.rowIndex,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    finishedAt: input.status === 'FINISHED' ? (previous?.finishedAt ?? now) : null,
  }
}
