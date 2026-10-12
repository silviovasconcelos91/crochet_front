import { useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePatterns, usePublicPatterns } from '../api/queries'
import { Button } from '../components/Button'
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

  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({})
  const id = useId()

  // « Mes patterns » n'attend que ma liste : les publics commencés s'y ajoutent dès qu'ils arrivent.
  const primary = tab === 'catalogue' ? publics : mine
  const { isPending } = primary
  const failed = primary.isError ? primary : undefined
  const startedFailed = tab === 'mine' && mine.isSuccess && publics.isError
  const data = tab === 'catalogue' ? publics.data : mine.data && mergeMyPatterns(mine.data, publics.data ?? [])
  const visible = (data ?? []).filter((pattern) => filter === 'all' || patternState(pattern.progress) === filter)

  const selectTab = (next: Tab) => {
    if (next === tab) return
    // Remplace l'entrée : Retour quitte la page au lieu de rejouer les changements d'onglet.
    setParams(next === 'catalogue' ? { onglet: 'catalogue' } : {}, { replace: true })
    setFilter('all')
  }

  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex(({ value }) => value === tab)
    const target = {
      ArrowRight: (index + 1) % TABS.length,
      ArrowLeft: (index - 1 + TABS.length) % TABS.length,
      Home: 0,
      End: TABS.length - 1,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    const next = TABS[target].value
    selectTab(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{tab === 'catalogue' ? 'Catalogue public' : 'Mes patterns'}</h1>

      <div
        role="tablist"
        aria-label="Listes de patterns"
        onKeyDown={onTabKeyDown}
        className="grid grid-cols-2 rounded-xl bg-stone-200 p-1"
      >
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            ref={(element) => {
              tabRefs.current[value] = element
            }}
            id={`${id}-tab-${value}`}
            type="button"
            role="tab"
            aria-selected={tab === value}
            aria-controls={`${id}-panel`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => selectTab(value)}
            className={`min-h-11 rounded-lg text-sm font-medium ${tab === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="flex flex-col gap-4">
        {startedFailed && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200"
          >
            <p>Les patterns publics commencés n’ont pas pu être chargés.</p>
            <Button variant="secondary" onClick={() => void publics.refetch()}>
              Réessayer
            </Button>
          </div>
        )}

        {isPending && (
          <div className="flex flex-col gap-3">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        )}

        {!isPending && failed && <ErrorState error={failed.error} onRetry={() => void failed.refetch()} />}

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
      </div>

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
