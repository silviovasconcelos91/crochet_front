import { useEffect, useRef } from 'react'
import type { Pattern } from '../../api/types'
import { Button } from '../../components/Button'
import { formatDate } from '../../lib/format'
import { isFirstRow, isLastRow, patternState } from '../../lib/progress'
import type { ProgressActionsApi } from './useProgressActions'

/** Délai pendant lequel un bouton qui vient d'apparaître sous le doigt ignore les appuis. */
export const TAP_GUARD_MS = 500

type PrimaryAction = 'start' | 'next' | 'finish' | 'reopen'

export function ProgressActions({ pattern, actions }: { pattern: Pattern; actions: ProgressActionsApi }) {
  const { progress, steps } = pattern
  const state = patternState(progress)
  const primary: PrimaryAction =
    state === 'not-started' ? 'start' : state === 'finished' ? 'reopen' : progress && isLastRow(steps, progress) ? 'finish' : 'next'

  // Le bouton principal change de rôle (Rang suivant → Terminer, Rouvrir → Rang suivant…) :
  // le second appui d'un double appui ne doit pas déclencher la nouvelle action.
  const previous = useRef(primary)
  const changedAt = useRef(Number.NEGATIVE_INFINITY)
  useEffect(() => {
    if (previous.current !== primary) {
      previous.current = primary
      changedAt.current = performance.now()
    }
  }, [primary])

  const guarded = (action: () => void) => () => {
    if (performance.now() - changedAt.current < TAP_GUARD_MS) return
    action()
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 touch-manipulation border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {state === 'not-started' && (
          <Button className="h-14 flex-1 text-lg" onClick={guarded(actions.start)}>
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
            {primary === 'finish' ? (
              <Button className="h-14 flex-1 text-lg" onClick={guarded(actions.finish)}>
                Terminer ✓
              </Button>
            ) : (
              <Button className="h-14 flex-1 text-lg" onClick={guarded(actions.next)}>
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
            <Button variant="secondary" className="h-14" onClick={guarded(actions.reopen)}>
              Rouvrir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
