import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePatterns, usePublicPatterns } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { mergeMyPatterns } from '../lib/patternLists'
import { patternState, type PatternState } from '../lib/progress'
import { PatternCard } from './patternList/PatternCard'

type Filter = 'all' | PatternState
type Tab = 'mine' | 'catalogue'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'finished', label: 'Terminés' },
  { value: 'not-started', label: 'Non commencés' },
]

const TABS: { value: Tab; label: string }[] = [
  { value: 'mine', label: 'Mes patterns' },
  { value: 'catalogue', label: 'Catalogue' },
]

export function PatternListPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('onglet') === 'catalogue' ? 'catalogue' : 'mine'
  const mine = usePatterns()
  const publics = usePublicPatterns()
  const [filter, setFilter] = useState<Filter>('all')

  const queries = tab === 'catalogue' ? [publics] : [mine, publics]
  const isPending = queries.some((query) => query.isPending)
  const failed = queries.find((query) => query.isError)
  const data =
    tab === 'catalogue' ? publics.data : mine.data && publics.data ? mergeMyPatterns(mine.data, publics.data) : undefined
  const visible = (data ?? []).filter((pattern) => filter === 'all' || patternState(pattern.progress) === filter)

  const selectTab = (next: Tab) => {
    // Remplace l'entrée : Retour quitte la page au lieu de rejouer les changements d'onglet.
    setParams(next === 'catalogue' ? { onglet: 'catalogue' } : {}, { replace: true })
    setFilter('all')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{tab === 'catalogue' ? 'Catalogue public' : 'Mes patterns'}</h1>

      <div role="tablist" aria-label="Listes de patterns" className="grid grid-cols-2 rounded-xl bg-stone-200 p-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`min-h-11 rounded-lg text-sm font-medium ${tab === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {!isPending && failed && <ErrorState error={failed.error} onRetry={() => queries.forEach((query) => void query.refetch())} />}

      {!isPending && !failed && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          {tab === 'catalogue' ? (
            <p className="text-stone-600">Aucun pattern public pour l’instant.</p>
          ) : (
            <>
              <p className="text-stone-600">Aucun pattern pour l’instant.</p>
              <Link to="/patterns/new" className="rounded-xl bg-rose-600 px-4 py-3 font-medium text-white">
                Créer mon premier pattern
              </Link>
            </>
          )}
        </div>
      )}

      {!isPending && !failed && data && data.length > 0 && (
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

      {tab === 'mine' && (
        <Link
          to="/patterns/new"
          aria-label="Nouveau pattern"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-rose-600 text-3xl text-white shadow-lg active:bg-rose-700"
        >
          +
        </Link>
      )}
    </div>
  )
}
