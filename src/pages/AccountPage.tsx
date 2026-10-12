import { useLogout, useMe } from '../api/queries'
import { Button } from '../components/Button'
import { useToast } from '../components/toast/useToast'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { ChangePasswordForm } from './account/ChangePasswordForm'
import { DeleteAccountForm } from './account/DeleteAccountForm'

export function AccountPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const toast = useToast()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      {me && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="font-medium">{me.email}</p>
          <p className="text-sm text-stone-500">Inscrit le {formatDate(me.createdAt)}</p>
        </section>
      )}
      <ChangePasswordForm />
      <Button
        variant="secondary"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onError: (error) => toast.show(errorMessage(error), 'error') })}
      >
        Se déconnecter
      </Button>
      <DeleteAccountForm />
    </div>
  )
}
