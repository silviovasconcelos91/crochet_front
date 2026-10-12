import type { ReactNode } from 'react'

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-2xl font-bold text-rose-700">🧶 Crochet</p>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
      <p className="text-center text-sm text-stone-600">{footer}</p>
    </main>
  )
}
