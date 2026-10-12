import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'
import { queryKeys } from './queries'

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

export function createQueryClient(): QueryClient {
  // Tout 401 hors login : la session est perdue, RequireAuth redirige vers /login.
  const handleUnauthorized = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(queryKeys.me, null)
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== queryKeys.me[0]) handleUnauthorized(error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.skipAuthRedirect) handleUnauthorized(error)
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return queryClient
}
