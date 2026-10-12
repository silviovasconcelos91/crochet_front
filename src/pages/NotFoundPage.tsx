import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 pt-20 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <Link to="/" className="font-medium text-rose-700 underline">
        Retour à mes patterns
      </Link>
    </main>
  )
}
