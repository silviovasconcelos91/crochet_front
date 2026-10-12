import { useState } from 'react'
import type { Pattern } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { VisibilityBadge } from '../../components/VisibilityBadge'
import { formatHookSize } from '../../lib/format'
import { isHttpUrl } from '../../lib/url'

export function PatternInfo({ pattern }: { pattern: Pattern }) {
  // Mémorise l'URL en échec : une nouvelle URL (après édition) retente l'affichage.
  const [failedImage, setFailedImage] = useState<string | null>(null)
  const meta = [pattern.hookSizeMm !== null ? `Crochet ${formatHookSize(pattern.hookSizeMm)} mm` : null, pattern.yarn]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="flex flex-col gap-3">
      {pattern.mine ? (
        <div>
          <VisibilityBadge visibility={pattern.visibility} />
        </div>
      ) : (
        <p className="text-sm text-stone-500">par {pattern.author.username}</p>
      )}
      {isHttpUrl(pattern.imageUrl) && pattern.imageUrl !== failedImage && (
        <img
          src={pattern.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedImage(pattern.imageUrl)}
          className="max-h-64 w-full rounded-2xl object-cover"
        />
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
