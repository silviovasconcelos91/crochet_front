import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { queryKeys, useUpdateProgress } from '../../api/queries'
import type { Pattern, Position, ProgressStatus, Step } from '../../api/types'
import { useToast } from '../../components/toast/useToast'
import { errorMessage } from '../../lib/errors'
import { nextPosition, prevPosition } from '../../lib/progress'

export interface ProgressActionsApi {
  start: () => void
  next: () => void
  prev: () => void
  finish: () => void
  reopen: () => void
  selectRow: (stepIndex: number, rowIndex: number) => void
}

export function useProgressActions(patternId: number): ProgressActionsApi {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { mutate } = useUpdateProgress(patternId, { onError: (error) => toast.show(errorMessage(error), 'error') })

  return useMemo(() => {
    // Toujours lire le cache au moment de l'appui, jamais la valeur capturée au rendu.
    const current = () => queryClient.getQueryData<Pattern>(queryKeys.pattern(patternId))

    const move = (compute: (steps: Step[], pos: Position) => Position | null) => {
      const pattern = current()
      if (!pattern?.progress) return
      const position = compute(pattern.steps, pattern.progress)
      if (position) mutate({ status: 'IN_PROGRESS', ...position })
    }

    const setStatus = (status: ProgressStatus) => {
      const progress = current()?.progress
      if (!progress) return
      mutate({ status, stepIndex: progress.stepIndex, rowIndex: progress.rowIndex })
    }

    return {
      start: () => mutate({ status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0 }),
      next: () => move(nextPosition),
      prev: () => move(prevPosition),
      finish: () => setStatus('FINISHED'),
      reopen: () => setStatus('IN_PROGRESS'),
      selectRow: (stepIndex, rowIndex) =>
        mutate({ status: current()?.progress?.status ?? 'IN_PROGRESS', stepIndex, rowIndex }),
    }
  }, [queryClient, patternId, mutate])
}
