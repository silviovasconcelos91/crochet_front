import { Outlet } from 'react-router'
import { useCsrf, useMe } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { FullPageSpinner } from '../components/Spinner'

/** Pose le cookie XSRF puis lit la session avant d'afficher quoi que ce soit. */
export function Root() {
  const csrf = useCsrf()
  const me = useMe(csrf.isSuccess)

  if (csrf.isError || me.isError) {
    return (
      <main className="mx-auto max-w-sm px-4 pt-20">
        <ErrorState
          error={csrf.error ?? me.error}
          onRetry={() => {
            if (csrf.isError) void csrf.refetch()
            if (me.isError) void me.refetch()
          }}
        />
      </main>
    )
  }
  if (!csrf.isSuccess || me.isPending) return <FullPageSpinner />
  return <Outlet />
}
