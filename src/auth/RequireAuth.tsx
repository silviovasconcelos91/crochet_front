import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../api/queries'

export function RequireAuth() {
  const { data: me } = useMe()
  const location = useLocation()
  if (!me) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}
