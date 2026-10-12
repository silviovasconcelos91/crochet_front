import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { ApiError } from '../api/client'
import { useRegister } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { applyServerErrors } from '../lib/formErrors'
import { confirmRule, emailRules, newPasswordRules } from '../lib/validation'

interface RegisterValues {
  email: string
  password: string
  confirm: string
}

export function RegisterPage() {
  const form = useForm<RegisterValues>({ defaultValues: { email: '', password: '', confirm: '' } })
  const { register, handleSubmit, getValues, setError, formState: { errors } } = form
  const registerMutation = useRegister()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await registerMutation.mutateAsync({ email: values.email.trim(), password: values.password })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { type: 'server', message: errorMessage(error) }, { shouldFocus: true })
      } else {
        setBanner(applyServerErrors(error, form))
      }
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
