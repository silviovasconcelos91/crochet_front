import { Button } from '../components/Button'

export function RouteError() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 pt-20 text-center">
      <h1 className="text-2xl font-semibold">Oups</h1>
      <p className="text-stone-600">Une erreur inattendue est survenue.</p>
      <Button onClick={() => window.location.reload()}>Recharger</Button>
    </main>
  )
}
