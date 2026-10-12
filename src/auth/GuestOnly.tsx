import { Navigate, Outlet, useSearchParams } from 'react-router'
import { useMe } from '../api/queries'
import { safeRedirect } from '../lib/redirect'

/** Login/inscription : dès que `me` existe (après succès), on part vers `redirect`. */
export function GuestOnly() {
  const { data: me } = useMe()
  const [params] = useSearchParams()
  if (me) return <Navigate to={safeRedirect(params.get('redirect'))} replace />
  return <Outlet />
}
