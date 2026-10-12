import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate } from 'react-router'
import { useSavePattern } from '../../api/queries'
import type { Pattern } from '../../api/types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormBanner } from '../../components/FormBanner'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { applyServerErrors, scheduleFocusFirstError } from '../../lib/formErrors'
import { isHttpUrl } from '../../lib/url'
import { maxChars, requiredText } from '../../lib/validation'
import { emptyForm, emptyStep, toFormValues, toPatternInput, validateHookSize, type PatternFormValues } from './formModel'
import { StepFields } from './StepFields'

export function PatternForm({ pattern }: { pattern?: Pattern }) {
  const form = useForm<PatternFormValues>({
    defaultValues: pattern ? toFormValues(pattern) : emptyForm(),
    shouldFocusError: false,
  })
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form
  const steps = useFieldArray({ control, name: 'steps' })
  const imageUrl = useWatch({ control, name: 'imageUrl' })
  const save = useSavePattern(pattern?.id)
  const navigate = useNavigate()
  const [banner, setBanner] = useState<string | null>(null)
  const saved = useRef(false)

  // Pas de blocage après succès, ni vers /login (session expirée : la redirection doit passer).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !saved.current && nextLocation.pathname !== '/login' && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSubmit = handleSubmit(
    async (values) => {
      setBanner(null)
      try {
        const result = await save.mutateAsync(toPatternInput(values))
        saved.current = true
        navigate(`/patterns/${result.id}`, { replace: true })
      } catch (error) {
        setBanner(applyServerErrors(error, form))
      }
    },
    () => scheduleFocusFirstError(form),
  )

  const backTo = pattern ? `/patterns/${pattern.id}` : '/'

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Link to={backTo} aria-label="Retour" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="text-xl font-semibold">{pattern ? 'Modifier le pattern' : 'Nouveau pattern'}</h1>
      </header>

      {pattern?.progress && (
        <FormBanner
          tone="info"
          message="Si tu supprimes le rang en cours, l’avancement sera recalé sur le dernier rang existant."
        />
      )}
      <FormBanner message={banner} />

      <section className="flex flex-col gap-4">
        <TextField label="Titre *" error={errors.title?.message} {...register('title', { validate: requiredText, maxLength: maxChars(200) })} />
        <TextArea label="Description" rows={2} {...register('description')} />
        <TextField
          label="Taille du crochet (mm)"
          inputMode="decimal"
          placeholder="3,5"
          error={errors.hookSizeMm?.message}
          {...register('hookSizeMm', { validate: validateHookSize })}
        />
        <TextField label="Laine" error={errors.yarn?.message} {...register('yarn', { maxLength: maxChars(200) })} />
        <TextField
          label="URL source"
          type="url"
          inputMode="url"
          error={errors.sourceUrl?.message}
          {...register('sourceUrl', { maxLength: maxChars(500) })}
        />
        <div className="flex items-end gap-3">
          <TextField
            className="flex-1"
            label="URL image"
            type="url"
            inputMode="url"
            error={errors.imageUrl?.message}
            {...register('imageUrl', { maxLength: maxChars(500) })}
          />
          {isHttpUrl(imageUrl) && <img src={imageUrl} alt="Aperçu" className="size-11 rounded-xl object-cover" />}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Étapes</h2>
        {steps.fields.map((field, index) => (
          <StepFields
            key={field.id}
            index={index}
            count={steps.fields.length}
            form={form}
            onMoveUp={() => steps.move(index, index - 1)}
            onMoveDown={() => steps.move(index, index + 1)}
            onRemove={() => steps.remove(index)}
          />
        ))}
        <Button variant="secondary" aria-label="Ajouter une étape" onClick={() => steps.append(emptyStep())}>
          + Étape
        </Button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button type="submit" className="h-14 w-full text-lg" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Quitter sans enregistrer ?"
        message="Tes modifications seront perdues."
        confirmLabel="Quitter"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </form>
  )
}
