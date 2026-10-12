import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { useLogin } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { applyServerErrors } from '../lib/formErrors'
import { requiredText } from '../lib/validation'

interface LoginValues {
  username: string
  password: string
}

export function LoginPage() {
  const form = useForm<LoginValues>({ defaultValues: { username: '', password: '' } })
  const { register, handleSubmit, formState: { errors } } = form
  const loginMutation = useLogin()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      // Succès : `me` est écrit dans le cache, GuestOnly redirige.
      await loginMutation.mutateAsync({ username: values.username.trim(), password: values.password })
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <AuthShell
      title="Connexion"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to={{ pathname: '/register', search: location.search }} className="font-medium text-rose-700 underline">
            Créer un compte
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
          error={errors.username?.message}
          {...register('username', { validate: requiredText })}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Obligatoire' })}
        />
        <Button type="submit" loading={loginMutation.isPending}>
          Se connecter
        </Button>
      </form>
    </AuthShell>
  )
}
