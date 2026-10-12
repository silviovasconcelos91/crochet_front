import { useEffect, useState } from 'react'
import type { Progress, Step } from '../../api/types'
import { compareToCurrent, type RowState } from '../../lib/progress'

const ROW_STYLES: Record<RowState, string> = {
  past: 'text-stone-400',
  current: 'bg-rose-100 text-lg font-semibold text-stone-900 ring-2 ring-rose-500',
  future: 'text-stone-800',
}

interface StepListProps {
  steps: Step[]
  progress: Progress | null
  onSelectRow: (stepIndex: number, rowIndex: number) => void
}

export function StepList({ steps, progress, onSelectRow }: StepListProps) {
  // Centre le rang courant à l'ouverture et à chaque déplacement.
  useEffect(() => {
    document.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [progress?.stepIndex, progress?.rowIndex])

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, stepIndex) => (
        <StepSection key={stepIndex} step={step} stepIndex={stepIndex} progress={progress} onSelectRow={onSelectRow} />
      ))}
    </ol>
  )
}

function StepSection({
  step,
  stepIndex,
  progress,
  onSelectRow,
}: {
  step: Step
  stepIndex: number
  progress: Progress | null
  onSelectRow: StepListProps['onSelectRow']
}) {
  const isPast = progress !== null && stepIndex < progress.stepIndex
  const isCurrent = progress !== null && stepIndex === progress.stepIndex
  const [open, setOpen] = useState(!isPast)
  const isOpen = open || isCurrent

  return (
    <li className="rounded-2xl bg-white p-2 ring-1 ring-stone-200">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen(!isOpen)}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left font-semibold ${isPast ? 'text-stone-400' : ''}`}
        >
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          {stepIndex + 1}. {step.title}
        </button>
      </h2>
      {isOpen && (
        <ol className="mt-1 flex flex-col gap-1">
          {step.rows.map((row, rowIndex) => {
            const state = compareToCurrent(stepIndex, rowIndex, progress)
            return (
              <li key={rowIndex}>
                <button
                  type="button"
                  aria-label={`Rang ${row.number} : ${row.value}`}
                  aria-current={state === 'current' ? 'step' : undefined}
                  onClick={() => onSelectRow(stepIndex, rowIndex)}
                  className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-2 py-2 text-left ${ROW_STYLES[state]}`}
                >
                  <span className="w-12 shrink-0 font-mono text-sm leading-7">{row.number}</span>
                  <span className="whitespace-pre-wrap">{row.value}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}
