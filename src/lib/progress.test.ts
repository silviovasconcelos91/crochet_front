import { describe, expect, it } from 'vitest'
import type { Progress, Step } from '../api/types'
import {
  compareToCurrent,
  isFirstRow,
  isLastRow,
  nextPosition,
  optimisticProgress,
  patternState,
  prevPosition,
} from './progress'

const row = (n: string) => ({ number: n, value: `rang ${n}` })
const steps: Step[] = [
  { title: 'A', rows: [row('1'), row('2')] },
  { title: 'B', rows: [row('1')] },
  { title: 'C', rows: [row('1'), row('2'), row('3')] },
]

const progress = (stepIndex: number, rowIndex: number, status: Progress['status'] = 'IN_PROGRESS'): Progress => ({
  status,
  stepIndex,
  rowIndex,
  startedAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  finishedAt: status === 'FINISHED' ? '2026-10-02T10:00:00Z' : null,
})

describe('nextPosition', () => {
  it('avance dans la même étape', () => {
    expect(nextPosition(steps, { stepIndex: 0, rowIndex: 0 })).toEqual({ stepIndex: 0, rowIndex: 1 })
  })
  it('passe au premier rang de l’étape suivante', () => {
    expect(nextPosition(steps, { stepIndex: 0, rowIndex: 1 })).toEqual({ stepIndex: 1, rowIndex: 0 })
  })
  it('traverse une étape à un seul rang', () => {
    expect(nextPosition(steps, { stepIndex: 1, rowIndex: 0 })).toEqual({ stepIndex: 2, rowIndex: 0 })
  })
  it('renvoie null au dernier rang de la dernière étape', () => {
    expect(nextPosition(steps, { stepIndex: 2, rowIndex: 2 })).toBeNull()
  })
})

describe('prevPosition', () => {
  it('recule dans la même étape', () => {
    expect(prevPosition(steps, { stepIndex: 2, rowIndex: 2 })).toEqual({ stepIndex: 2, rowIndex: 1 })
  })
  it('revient au dernier rang de l’étape précédente', () => {
    expect(prevPosition(steps, { stepIndex: 1, rowIndex: 0 })).toEqual({ stepIndex: 0, rowIndex: 1 })
  })
  it('renvoie null au tout premier rang', () => {
    expect(prevPosition(steps, { stepIndex: 0, rowIndex: 0 })).toBeNull()
  })
})

describe('isFirstRow / isLastRow', () => {
  it('détecte les bornes', () => {
    expect(isFirstRow(steps, { stepIndex: 0, rowIndex: 0 })).toBe(true)
    expect(isFirstRow(steps, { stepIndex: 1, rowIndex: 0 })).toBe(false)
    expect(isLastRow(steps, { stepIndex: 2, rowIndex: 2 })).toBe(true)
    expect(isLastRow(steps, { stepIndex: 1, rowIndex: 0 })).toBe(false)
  })
})

describe('compareToCurrent', () => {
  it('tout est futur si non commencé', () => {
    expect(compareToCurrent(0, 0, null)).toBe('future')
  })
  it('classe passé, courant et futur', () => {
    const p = progress(1, 0)
    expect(compareToCurrent(0, 1, p)).toBe('past')
    expect(compareToCurrent(1, 0, p)).toBe('current')
    expect(compareToCurrent(2, 0, p)).toBe('future')
  })
  it('compare les rangs dans l’étape courante', () => {
    const p = progress(2, 1)
    expect(compareToCurrent(2, 0, p)).toBe('past')
    expect(compareToCurrent(2, 2, p)).toBe('future')
  })
})

describe('patternState', () => {
  it('mappe le progress en état', () => {
    expect(patternState(null)).toBe('not-started')
    expect(patternState(progress(0, 0))).toBe('in-progress')
    expect(patternState(progress(0, 0, 'FINISHED'))).toBe('finished')
  })
})

describe('optimisticProgress', () => {
  const now = '2026-10-12T12:00:00Z'
  it('démarre un pattern', () => {
    expect(optimisticProgress(null, { status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0 }, now)).toEqual({
      status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0, startedAt: now, updatedAt: now, finishedAt: null,
    })
  })
  it('conserve startedAt et fixe finishedAt à la fin', () => {
    const result = optimisticProgress(progress(1, 0), { status: 'FINISHED', stepIndex: 1, rowIndex: 0 }, now)
    expect(result).toMatchObject({ startedAt: '2026-10-01T10:00:00Z', finishedAt: now, status: 'FINISHED' })
  })
  it('garde le finishedAt existant si on re-termine', () => {
    const result = optimisticProgress(progress(1, 0, 'FINISHED'), { status: 'FINISHED', stepIndex: 1, rowIndex: 0 }, now)
    expect(result.finishedAt).toBe('2026-10-02T10:00:00Z')
  })
  it('remet finishedAt à null quand on rouvre', () => {
    const result = optimisticProgress(progress(1, 0, 'FINISHED'), { status: 'IN_PROGRESS', stepIndex: 1, rowIndex: 0 }, now)
    expect(result.finishedAt).toBeNull()
  })
})
