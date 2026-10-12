import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAbandonProgress, useDeletePattern } from '../../api/queries'
import type { Pattern } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/toast/useToast'
import { useKeepAwakePreference } from '../../hooks/useKeepAwakePreference'
import { useWakeLock } from '../../hooks/useWakeLock'
import { errorMessage } from '../../lib/errors'
import { patternState } from '../../lib/progress'
import { PatternInfo } from './PatternInfo'
import { PatternMenu } from './PatternMenu'
import { ProgressActions } from './ProgressActions'
import { StepList } from './StepList'
import { useProgressActions } from './useProgressActions'

type Confirm = 'abandon' | 'delete' | null

export function PatternDetail({ pattern }: { pattern: Pattern }) {
  const actions = useProgressActions(pattern.id)
  const abandon = useAbandonProgress(pattern.id)
  const remove = useDeletePattern(pattern.id)
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [keepAwake, setKeepAwake] = useKeepAwakePreference()

  useWakeLock(keepAwake && patternState(pattern.progress) === 'in-progress')

  const onError = (error: unknown) => {
    setConfirm(null)
    toast.show(errorMessage(error), 'error')
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Retour à la liste" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{pattern.title}</h1>
        <PatternMenu
          pattern={pattern}
          actions={actions}
          keepAwake={keepAwake}
          onKeepAwakeChange={setKeepAwake}
          onAbandon={() => setConfirm('abandon')}
          onDelete={() => setConfirm('delete')}
        />
      </header>
      <PatternInfo pattern={pattern} />
      <StepList steps={pattern.steps} progress={pattern.progress} onSelectRow={actions.selectRow} />
      <ProgressActions pattern={pattern} actions={actions} />

      <ConfirmDialog
        open={confirm === 'abandon'}
        title="Abandonner l’avancement ?"
        message="Ta position sera effacée et le pattern redeviendra non commencé."
        confirmLabel="Abandonner"
        danger
        loading={abandon.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => abandon.mutate(undefined, { onSuccess: () => setConfirm(null), onError })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Supprimer ce pattern ?"
        message="Le pattern et son avancement seront définitivement supprimés."
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Pattern supprimé', 'success')
              navigate('/', { replace: true })
            },
            onError,
          })
        }
      />
    </div>
  )
}
