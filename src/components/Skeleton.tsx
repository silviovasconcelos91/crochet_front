export function Skeleton({ className = 'h-20' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />
}
