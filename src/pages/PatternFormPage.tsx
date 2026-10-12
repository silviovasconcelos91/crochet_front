import { Link, useParams } from 'react-router'
import { usePattern } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { PatternNotFound } from '../components/PatternNotFound'
import { Skeleton } from '../components/Skeleton'
import { isNotFound } from '../lib/errors'
import { parsePatternId } from '../lib/patternId'
import { PatternForm } from './patternForm/PatternForm'

export function PatternFormPage() {
  const rawId = useParams().id
  if (rawId === undefined) return <PatternForm />
  return <EditPattern rawId={rawId} />
}

function EditPattern({ rawId }: { rawId: string }) {
  const patternId = parsePatternId(rawId)
  const query = usePattern(patternId)

  if (patternId === null) return <PatternNotFound />
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (query.isError) {
    return isNotFound(query.error) ? <PatternNotFound /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  if (!query.data.mine) return <NotAuthor patternId={query.data.id} />
  return <PatternForm key={query.data.id} pattern={query.data} />
}

function NotAuthor({ patternId }: { patternId: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Seul l’auteur peut modifier ce pattern</h1>
      <Link to={`/patterns/${patternId}`} className="font-medium text-rose-700 underline">
        Retour au pattern
      </Link>
    </div>
  )
}
