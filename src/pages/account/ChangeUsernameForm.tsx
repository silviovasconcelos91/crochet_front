import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useChangeUsername } from '../../api/queries'
import { Button } from '../../components/Button'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { useToast } from '../../components/toast/useToast'
import { applyServerErrors } from '../../lib/formErrors'
import { USERNAME_HINT, usernameRules } from '../../lib/validation'

interface Values {
  username: string
  currentPassword: string
}

export function ChangeUsernameForm() {
  const form = useForm<Values>({ defaultValues: { username: '', currentPassword: '' } })
  const { register, handleSubmit, reset, formState: { errors } } = form
  const mutation = useChangeUsername()
  const toast = useToast()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async ({ username, currentPassword }) => {
    setBanner(null)
    try {
      await mutation.mutateAsync({ username: username.trim(), currentPassword })
      reset()
      toast.show('Pseudo modifié', 'success')
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">Changer de pseudo</h2>
      <FormBanner message={banner} />
      <TextField
        label="Nouveau pseudo"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        hint={USERNAME_HINT}
        error={errors.username?.message}
        {...register('username', usernameRules)}
      />
      <TextField
        label="Confirme avec ton mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword', { required: 'Obligatoire' })}
      />
      <Button type="submit" loading={mutation.isPending}>
        Changer de pseudo
      </Button>
    </form>
  )
}
