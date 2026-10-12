import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useChangePassword } from '../../api/queries'
import { Button } from '../../components/Button'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { useToast } from '../../components/toast/useToast'
import { applyServerErrors } from '../../lib/formErrors'
import { confirmRule, newPasswordRules } from '../../lib/validation'

interface Values {
  currentPassword: string
  newPassword: string
  confirm: string
}

export function ChangePasswordForm() {
  const form = useForm<Values>({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  const { register, handleSubmit, getValues, reset, formState: { errors } } = form
  const mutation = useChangePassword()
  const toast = useToast()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setBanner(null)
    try {
      await mutation.mutateAsync({ currentPassword, newPassword })
      reset()
      toast.show('Mot de passe modifié', 'success')
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
      <FormBanner message={banner} />
      <TextField
        label="Mot de passe actuel"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword', { required: 'Obligatoire' })}
      />
      <TextField
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum"
        error={errors.newPassword?.message}
        {...register('newPassword', newPasswordRules)}
      />
      <TextField
        label="Confirmer le nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm', confirmRule(() => getValues('newPassword')))}
      />
      <Button type="submit" loading={mutation.isPending}>
        Modifier le mot de passe
      </Button>
    </form>
  )
}
