import { useQuery } from '@tanstack/react-query'
import { fetchCsrf, getMe } from './auth'

export const queryKeys = {
  csrf: ['csrf'] as const,
  me: ['me'] as const,
  patterns: ['patterns'] as const,
  pattern: (id: number) => ['patterns', id] as const,
}

export function useCsrf() {
  return useQuery({
    queryKey: queryKeys.csrf,
    queryFn: async () => {
      await fetchCsrf()
      return true
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe, staleTime: Infinity, enabled })
}
