import { useState } from 'react'
import { Link } from 'react-router'
import { usePatterns } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { patternState, type PatternState } from '../lib/progress'
import { PatternCard } from './patternList/PatternCard'

type Filter = 'all' | PatternState

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'finished', label: 'Terminés' },
  { value: 'not-started', label: 'Non commencés' },
]

export function PatternListPage() {
  const { data, isPending, isError, error, refetch } = usePatterns()
  const [filter, setFilter] = useState<Filter>('all')

  const visible = (data ?? []).filter((pattern) => filter === 'all' || patternState(pattern.progress) === filter)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes patterns</h1>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-stone-600">Aucun pattern pour l’instant.</p>
          <Link to="/patterns/new" className="rounded-xl bg-rose-600 px-4 py-3 font-medium text-white">
            Créer mon premier pattern
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
                  filter === value ? 'bg-rose-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-stone-600">Aucun pattern dans cette catégorie.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((pattern) => (
                <li key={pattern.id}>
                  <PatternCard pattern={pattern} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Link
        to="/patterns/new"
        aria-label="Nouveau pattern"
        className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-rose-600 text-3xl text-white shadow-lg active:bg-rose-700"
      >
        +
      </Link>
    </div>
  )
}
