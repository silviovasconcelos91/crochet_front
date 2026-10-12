import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCsrf, getMe, login, register } from './auth'
import { listPatterns } from './patterns'

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

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    meta: { skipAuthRedirect: true },
    onSuccess: (account) => {
      queryClient.removeQueries({ queryKey: queryKeys.patterns })
      queryClient.setQueryData(queryKeys.me, account)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: register,
    onSuccess: (account) => {
      queryClient.removeQueries({ queryKey: queryKeys.patterns })
      queryClient.setQueryData(queryKeys.me, account)
    },
  })
}

export function usePatterns() {
  return useQuery({ queryKey: queryKeys.patterns, queryFn: listPatterns })
}
