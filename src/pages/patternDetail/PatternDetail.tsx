import { Link } from 'react-router'
import type { Pattern } from '../../api/types'
import { PatternInfo } from './PatternInfo'
import { ProgressActions } from './ProgressActions'
import { StepList } from './StepList'
import { useProgressActions } from './useProgressActions'

export function PatternDetail({ pattern }: { pattern: Pattern }) {
  const actions = useProgressActions(pattern.id)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Retour à la liste" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{pattern.title}</h1>
      </header>
      <PatternInfo pattern={pattern} />
      <StepList steps={pattern.steps} progress={pattern.progress} onSelectRow={actions.selectRow} />
      <ProgressActions pattern={pattern} actions={actions} />
    </div>
  )
}
