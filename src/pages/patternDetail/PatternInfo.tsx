import type { Pattern } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { formatHookSize } from '../../lib/format'
import { isHttpUrl } from '../../lib/url'

export function PatternInfo({ pattern }: { pattern: Pattern }) {
  const meta = [pattern.hookSizeMm !== null ? `Crochet ${formatHookSize(pattern.hookSizeMm)} mm` : null, pattern.yarn]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="flex flex-col gap-3">
      {isHttpUrl(pattern.imageUrl) && (
        <img src={pattern.imageUrl} alt="" className="max-h-64 w-full rounded-2xl object-cover" />
      )}
      {meta && <p className="text-stone-600">{meta}</p>}
      {isHttpUrl(pattern.sourceUrl) && (
        <a href={pattern.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-rose-700 underline">
          Source ↗
        </a>
      )}
      {pattern.description && (
        <details className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <summary className="cursor-pointer font-medium">Description</summary>
          <p className="mt-2 whitespace-pre-wrap text-stone-700">{pattern.description}</p>
        </details>
      )}
      <div>
        <StatusBadge progress={pattern.progress} stepCount={pattern.steps.length} showFinishedDate />
      </div>
    </section>
  )
}
