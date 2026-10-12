const TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

export function FormBanner({ message, tone = 'error' }: { message?: string | null; tone?: keyof typeof TONES }) {
  if (!message) return null
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ring-1 ${TONES[tone]}`}>
      {message}
    </div>
  )
}
