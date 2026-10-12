import { useState } from 'react'
import { Link } from 'react-router'
import type { PatternSummary } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { formatHookSize } from '../../lib/format'
import { isHttpUrl } from '../../lib/url'

function Thumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!isHttpUrl(src) || failed) {
    return <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-xl bg-rose-50 text-2xl">🧶</div>
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-xl object-cover"
    />
  )
}

export function PatternCard({ pattern }: { pattern: PatternSummary }) {
  const meta = [pattern.hookSizeMm !== null ? `${formatHookSize(pattern.hookSizeMm)} mm` : null, pattern.yarn]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/patterns/${pattern.id}`} state={{ fromList: true }} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 active:bg-stone-50">
      <Thumbnail src={pattern.imageUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate font-semibold">{pattern.title}</h2>
        {meta && <p className="truncate text-sm text-stone-500">{meta}</p>}
        <div>
          <StatusBadge progress={pattern.progress} stepCount={pattern.stepCount} />
        </div>
      </div>
    </Link>
  )
}
