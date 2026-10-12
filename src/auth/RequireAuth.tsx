import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Outlet, useLocation } from 'react-router'
import { queryKeys, useMe } from '../api/queries'

export function RequireAuth() {
  const { data: me } = useMe()
  const location = useLocation()
  const queryClient = useQueryClient()
  if (!me) {
    // Déconnexion volontaire : pas de retour automatique vers la page quittée.
    if (queryClient.getQueryData(queryKeys.sessionEnd) === 'voluntary') return <Navigate to="/login" replace />
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}
