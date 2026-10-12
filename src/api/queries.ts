import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { changePassword, changeUsername, deleteAccount, fetchCsrf, getMe, login, logout, register } from './auth'
import { isNotStarted } from '../lib/errors'
import { optimisticProgress } from '../lib/progress'
import {
  createPattern,
  deletePattern,
  deleteProgress,
  getPattern,
  listPatterns,
  listPublicPatterns,
  putProgress,
  updatePattern,
} from './patterns'
import type { Pattern, PatternInput, PatternSummary, ProgressInput } from './types'

export const queryKeys = {
  csrf: ['csrf'] as const,
  me: ['me'] as const,
  sessionEnd: ['sessionEnd'] as const,
  patterns: ['patterns'] as const,
  publicPatterns: ['patterns', 'public'] as const,
  pattern: (id: number) => ['patterns', id] as const,
}

/** Les deux listes (mes patterns, catalogue) dépendent de toute écriture. */
function invalidateLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true }),
    queryClient.invalidateQueries({ queryKey: queryKeys.publicPatterns, exact: true }),
  ])
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
      queryClient.removeQueries({ queryKey: queryKeys.sessionEnd })
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
      queryClient.removeQueries({ queryKey: queryKeys.sessionEnd })
      queryClient.setQueryData(queryKeys.me, account)
    },
  })
}

// Les listes changent aussi par les autres comptes (pattern repassé en privé) : on les recharge au retour dans l'app.
export function usePublicPatterns() {
  return useQuery({ queryKey: queryKeys.publicPatterns, queryFn: listPublicPatterns, refetchOnWindowFocus: true })
}

export function usePatterns() {
  return useQuery({ queryKey: queryKeys.patterns, queryFn: listPatterns, refetchOnWindowFocus: true })
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
    onSettled: async () => {
      // Dernière mutation de la file : on relit le serveur, seule source de vérité
      // (échecs en cascade, pattern modifié depuis un autre appareil).
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        await queryClient.invalidateQueries({ queryKey: key, exact: true })
      }
      await invalidateLists(queryClient)
    },
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
      await invalidateLists(queryClient)
    },
  })
}

export function useDeletePattern(patternId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deletePattern(patternId),
    onSuccess: () => {
      queryClient.setQueryData<PatternSummary[]>(queryKeys.patterns, (list) => list?.filter((p) => p.id !== patternId))
      queryClient.setQueryData<PatternSummary[]>(queryKeys.publicPatterns, (list) => list?.filter((p) => p.id !== patternId))
      void invalidateLists(queryClient)
    },
  })
}

export function useSavePattern(patternId?: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatternInput) => (patternId === undefined ? createPattern(input) : updatePattern(patternId, input)),
    onSuccess: (pattern) => {
      queryClient.setQueryData(queryKeys.pattern(pattern.id), pattern)
      void invalidateLists(queryClient)
    },
  })
}

/**
 * Fin de session volontaire (déconnexion, suppression du compte). Le marqueur `sessionEnd`
 * dit à RequireAuth d'envoyer vers /login sans `redirect` : react-router applique ses
 * navigations en transition, donc RequireAuth peut voir `me = null` avant que /login soit affiché.
 */
function useEndSession() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return () => {
    queryClient.removeQueries({ queryKey: queryKeys.patterns })
    queryClient.setQueryData(queryKeys.sessionEnd, 'voluntary')
    queryClient.setQueryData(queryKeys.me, null)
    void navigate('/login', { replace: true })
  }
}

export function useLogout() {
  const endSession = useEndSession()
  return useMutation({ mutationFn: logout, onSuccess: endSession })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useDeleteAccount() {
  const endSession = useEndSession()
  return useMutation({ mutationFn: deleteAccount, onSuccess: endSession })
}

export function useChangeUsername() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: changeUsername,
    onSuccess: (account) => queryClient.setQueryData(queryKeys.me, account),
  })
}
