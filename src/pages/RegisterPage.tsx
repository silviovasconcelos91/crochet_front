import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { useRegister } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { applyServerErrors } from '../lib/formErrors'
import { confirmRule, emailRules, newPasswordRules, USERNAME_HINT, usernameRules } from '../lib/validation'

interface RegisterValues {
  username: string
  email: string
  password: string
  confirm: string
}

export function RegisterPage() {
  const form = useForm<RegisterValues>({ defaultValues: { username: '', email: '', password: '', confirm: '' } })
  const { register, handleSubmit, getValues, formState: { errors } } = form
  const registerMutation = useRegister()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await registerMutation.mutateAsync({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      })
    } catch (error) {
      // 409 : le serveur nomme le champ pris (pseudo et/ou email), mappé sous le bon champ.
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <AuthShell
      title="Créer un compte"
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to={{ pathname: '/login', search: location.search }} className="font-medium text-rose-700 underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormBanner message={banner} />
        <TextField
          label="Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          hint={USERNAME_HINT}
          error={errors.username?.message}
          {...register('username', usernameRules)}
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', emailRules)}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum"
          error={errors.password?.message}
          {...register('password', newPasswordRules)}
        />
        <TextField
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm', confirmRule(() => getValues('password')))}
        />
        <Button type="submit" loading={registerMutation.isPending}>
          Créer mon compte
        </Button>
      </form>
    </AuthShell>
  )
}
