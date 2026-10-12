import type { Visibility } from '../api/types'

const STYLES: Record<Visibility, string> = {
  PUBLIC: 'bg-sky-100 text-sky-900',
  PRIVATE: 'bg-stone-100 text-stone-700',
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[visibility]}`}>
      {visibility === 'PUBLIC' ? 'Public' : 'Privé'}
    </span>
  )
}
