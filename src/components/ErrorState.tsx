import { errorMessage } from '../lib/errors'
import { Button } from './Button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p role="alert" className="text-stone-700">
        {errorMessage(error)}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  )
}
