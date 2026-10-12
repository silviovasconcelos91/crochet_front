import { useParams } from 'react-router'
import { usePattern } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { PatternNotFound } from '../components/PatternNotFound'
import { Skeleton } from '../components/Skeleton'
import { isNotFound } from '../lib/errors'
import { parsePatternId } from '../lib/patternId'
import { PatternDetail } from './patternDetail/PatternDetail'

export function PatternDetailPage() {
  const patternId = parsePatternId(useParams().id)
  const query = usePattern(patternId)

  if (patternId === null) return <PatternNotFound />
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (query.isError) {
    return isNotFound(query.error) ? <PatternNotFound /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  return <PatternDetail pattern={query.data} />
}
