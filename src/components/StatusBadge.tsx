import type { Progress } from '../api/types'
import { formatDate } from '../lib/format'
import { patternState } from '../lib/progress'

const STYLES = {
  'not-started': 'bg-stone-100 text-stone-700',
  'in-progress': 'bg-amber-100 text-amber-900',
  finished: 'bg-emerald-100 text-emerald-900',
}

export function StatusBadge({
  progress,
  stepCount,
  showFinishedDate = false,
}: {
  progress: Progress | null
  stepCount: number
  showFinishedDate?: boolean
}) {
  const state = patternState(progress)
  let label = 'Non commencé'
  if (progress && state === 'in-progress') label = `En cours · étape ${progress.stepIndex + 1}/${stepCount}`
  if (progress && state === 'finished') {
    label = showFinishedDate && progress.finishedAt ? `Terminé le ${formatDate(progress.finishedAt)}` : 'Terminé'
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[state]}`}>{label}</span>
}
