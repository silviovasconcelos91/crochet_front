import { expect, it } from 'vitest'
import type { PatternSummary, Progress } from '../api/types'
import { mergeMyPatterns } from './patternLists'

const progress: Progress = {
  status: 'IN_PROGRESS',
  stepIndex: 0,
  rowIndex: 0,
  startedAt: '2026-10-12T12:00:00Z',
  updatedAt: '2026-10-12T12:00:00Z',
  finishedAt: null,
}

const summary = (id: number, title: string, extra: Partial<PatternSummary> = {}): PatternSummary => ({
  id,
  title,
  description: null,
  hookSizeMm: null,
  yarn: null,
  imageUrl: null,
  stepCount: 1,
  progress: null,
  visibility: 'PRIVATE',
  author: { username: 'ana' },
  mine: true,
  ...extra,
})

it('ajoute les patterns publics des autres que j’ai commencés, sans doublon, triés par titre', () => {
  const mine = [summary(1, 'zèbre'), summary(2, 'Abeille', { visibility: 'PUBLIC' })]
  const publics = [
    summary(2, 'Abeille', { visibility: 'PUBLIC' }),
    summary(3, 'Écureuil', { visibility: 'PUBLIC', mine: false, author: { username: 'bob' }, progress }),
    summary(4, 'Chat', { visibility: 'PUBLIC', mine: false, author: { username: 'bob' } }),
  ]
  expect(mergeMyPatterns(mine, publics).map((p) => p.id)).toEqual([2, 3, 1])
})

it('renvoie mes patterns quand le catalogue est vide', () => {
  expect(mergeMyPatterns([summary(1, 'Lapin')], [])).toHaveLength(1)
})
