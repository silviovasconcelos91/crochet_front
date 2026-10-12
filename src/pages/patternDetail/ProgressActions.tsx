import type { Pattern } from '../../api/types'
import { Button } from '../../components/Button'
import { formatDate } from '../../lib/format'
import { isFirstRow, isLastRow, patternState } from '../../lib/progress'
import type { ProgressActionsApi } from './useProgressActions'

export function ProgressActions({ pattern, actions }: { pattern: Pattern; actions: ProgressActionsApi }) {
  const { progress, steps } = pattern
  const state = patternState(progress)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {state === 'not-started' && (
          <Button className="h-14 flex-1 text-lg" onClick={actions.start}>
            Démarrer
          </Button>
        )}
        {state === 'in-progress' && progress && (
          <>
            <Button
              variant="secondary"
              className="h-14 w-28"
              aria-label="Rang précédent"
              disabled={isFirstRow(steps, progress)}
              onClick={actions.prev}
            >
              ◀ Préc.
            </Button>
            {isLastRow(steps, progress) ? (
              <Button className="h-14 flex-1 text-lg" onClick={actions.finish}>
                Terminer ✓
              </Button>
            ) : (
              <Button className="h-14 flex-1 text-lg" onClick={actions.next}>
                Rang suivant ▶
              </Button>
            )}
          </>
        )}
        {state === 'finished' && progress && (
          <>
            <p className="flex-1 font-medium text-emerald-800">
              {progress.finishedAt ? `Terminé le ${formatDate(progress.finishedAt)}` : 'Terminé'}
            </p>
            <Button variant="secondary" className="h-14" onClick={actions.reopen}>
              Rouvrir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
