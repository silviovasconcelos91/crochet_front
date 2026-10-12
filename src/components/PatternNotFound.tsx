import { Link } from 'react-router'

export function PatternNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Pattern introuvable</h1>
      <p className="text-stone-600">Il a peut-être été supprimé.</p>
      <Link to="/" className="font-medium text-rose-700 underline">
        Retour à la liste
      </Link>
    </div>
  )
}
