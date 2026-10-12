import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDeleteAccount } from '../../api/queries'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { applyServerErrors } from '../../lib/formErrors'

export function DeleteAccountForm() {
  const form = useForm<{ password: string }>({ defaultValues: { password: '' } })
  const { register, handleSubmit, getValues, formState: { errors } } = form
  const mutation = useDeleteAccount()
  const [confirming, setConfirming] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(() => {
    setBanner(null)
    setConfirming(true)
  })

  const onConfirm = async () => {
    try {
      // Succès : `me` passe à null, RequireAuth renvoie vers /login.
      await mutation.mutateAsync(getValues('password'))
    } catch (error) {
      setConfirming(false)
      setBanner(applyServerErrors(error, form))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
      <h2 className="text-lg font-semibold text-red-800">Zone danger</h2>
      <p className="text-sm text-red-900">La suppression du compte efface définitivement tous tes patterns.</p>
      <FormBanner message={banner} />
      <TextField
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password', { required: 'Obligatoire' })}
      />
      <Button type="submit" variant="danger">
        Supprimer mon compte
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Supprimer ton compte ?"
        message="Ton compte et tous tes patterns seront supprimés. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        danger
        loading={mutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void onConfirm()}
      />
    </form>
  )
}
