import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Pattern } from '../../api/types'
import { patternState } from '../../lib/progress'
import type { ProgressActionsApi } from './useProgressActions'

interface PatternMenuProps {
  pattern: Pattern
  actions: ProgressActionsApi
  keepAwake: boolean
  onKeepAwakeChange: (value: boolean) => void
  onAbandon: () => void
  onDelete: () => void
}

const ITEM = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-stone-100'

export function PatternMenu({ pattern, actions, keepAwake, onKeepAwakeChange, onAbandon, onDelete }: PatternMenuProps) {
  const [open, setOpen] = useState(false)
  const state = patternState(pattern.progress)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Actions du pattern"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-xl text-2xl hover:bg-stone-100"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-1 w-64 rounded-xl bg-white p-1 shadow-lg ring-1 ring-stone-200">
            <Link role="menuitem" to={`/patterns/${pattern.id}/edit`} state={{ fromDetail: true }} className={ITEM}>
              Modifier
            </Link>
            {state === 'in-progress' && (
              <button role="menuitem" type="button" className={ITEM} onClick={run(actions.finish)}>
                Terminer
              </button>
            )}
            {state !== 'not-started' && (
              <button role="menuitem" type="button" className={ITEM} onClick={run(onAbandon)}>
                Abandonner l’avancement
              </button>
            )}
            <button role="menuitem" type="button" className={`${ITEM} text-red-700`} onClick={run(onDelete)}>
              Supprimer le pattern
            </button>
            <label className={`${ITEM} gap-3 border-t border-stone-100`}>
              <input
                type="checkbox"
                checked={keepAwake}
                onChange={(event) => onKeepAwakeChange(event.target.checked)}
                className="size-5 accent-rose-600"
              />
              Écran toujours allumé
            </label>
          </div>
        </>
      )}
    </div>
  )
}
