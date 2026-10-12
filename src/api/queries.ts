import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCsrf, getMe, login, register } from './auth'
import { isNotStarted } from '../lib/errors'
import { optimisticProgress } from '../lib/progress'
import { deletePattern, deleteProgress, getPattern, listPatterns, putProgress } from './patterns'
import type { Pattern, PatternSummary, ProgressInput } from './types'

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

export function usePattern(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pattern(id ?? 0),
    queryFn: () => getPattern(id as number),
    enabled: id !== null,
  })
}

/**
 * Mises à jour d'avancement optimistes, sérialisées par pattern (scope) pour
 * encaisser les appuis rapides : chaque position est calculée depuis le cache courant.
 */
export function useUpdateProgress(patternId: number, options: { onError?: (error: unknown) => void } = {}) {
  const queryClient = useQueryClient()
  const key = queryKeys.pattern(patternId)
  const mutationKey = ['progress', patternId]
  return useMutation({
    mutationKey,
    scope: { id: `progress-${patternId}` },
    mutationFn: (input: ProgressInput) => putProgress(patternId, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<Pattern>(key)
      if (previous) queryClient.setQueryData<Pattern>(key, { ...previous, progress: optimisticProgress(previous.progress, input) })
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      options.onError?.(error)
    },
    onSuccess: (progress) => {
      // Une mutation plus récente est en file : on ne réécrit pas sa position optimiste.
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.setQueryData<Pattern>(key, (pattern) => (pattern ? { ...pattern, progress } : pattern))
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true }),
  })
}

export function useAbandonProgress(patternId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await deleteProgress(patternId)
      } catch (error) {
        // Déjà non commencé (abandon depuis un autre appareil) : c'est le résultat voulu.
        if (!isNotStarted(error)) throw error
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<Pattern>(queryKeys.pattern(patternId), (pattern) =>
        pattern ? { ...pattern, progress: null } : pattern,
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pattern(patternId), exact: true })
      await queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })
    },
  })
}

export function useDeletePattern(patternId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deletePattern(patternId),
    onSuccess: () => {
      queryClient.setQueryData<PatternSummary[]>(queryKeys.patterns, (list) => list?.filter((p) => p.id !== patternId))
      void queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })
    },
  })
}
