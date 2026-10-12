import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../../api/client'
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
import { clearDraft, readDraft, saveDraft } from './draft'
import { StepFields } from './StepFields'

export function PatternForm({ pattern }: { pattern?: Pattern }) {
  const defaults = pattern ? toFormValues(pattern) : emptyForm()
  const form = useForm<PatternFormValues>({ defaultValues: defaults, shouldFocusError: false })
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form
  const steps = useFieldArray({ control, name: 'steps' })
  const imageUrl = useWatch({ control, name: 'imageUrl' })
  const save = useSavePattern(pattern?.id)
  const navigate = useNavigate()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)
  const [draft, setDraft] = useState(() => readDraft(pattern?.id))
  const saved = useRef(false)
  const [confirmPrivate, setConfirmPrivate] = useState<PatternFormValues | null>(null)

  const restoreDraft = () => {
    if (!draft) return
    const steps = draft.steps?.length ? draft.steps : defaults.steps
    form.reset({ ...defaults, ...draft, steps }, { keepDefaultValues: true })
    clearDraft(pattern?.id)
    setDraft(null)
  }

  const dismissDraft = () => {
    clearDraft(pattern?.id)
    setDraft(null)
  }

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

  const persist = async (values: PatternFormValues) => {
    setBanner(null)
    try {
      const result = await save.mutateAsync(toPatternInput(values))
      saved.current = true
      clearDraft(pattern?.id)
      // Ouvert depuis le détail : on y revient sans empiler une seconde entrée d'historique.
      if (pattern && (location.state as { fromDetail?: boolean } | null)?.fromDetail) navigate(-1)
      else navigate(`/patterns/${result.id}`, { replace: true })
    } catch (error) {
      // Session expirée : la redirection vers le login va suivre, on garde la saisie.
      if (error instanceof ApiError && error.status === 401) saveDraft(pattern?.id, values)
      setBanner(applyServerErrors(error, form))
    }
  }

  const onSubmit = handleSubmit(
    async (values) => {
      // Public → privé coupe l'accès des autres comptes : on confirme d'abord.
      if (pattern?.visibility === 'PUBLIC' && values.visibility === 'PRIVATE') {
        setConfirmPrivate(values)
        return
      }
      await persist(values)
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
      {draft && (
        <div role="status" className="flex flex-col gap-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <p>Une saisie non enregistrée (session expirée) a été retrouvée.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={restoreDraft}>
              Restaurer
            </Button>
            <Button variant="secondary" className="flex-1" onClick={dismissDraft}>
              Ignorer
            </Button>
          </div>
        </div>
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
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-stone-700">Visibilité</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-stone-300 has-checked:ring-2 has-checked:ring-rose-500">
            <input type="radio" value="PRIVATE" className="size-5 accent-rose-600" {...register('visibility')} />
            Privé — visible par moi seul
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-stone-300 has-checked:ring-2 has-checked:ring-rose-500">
            <input type="radio" value="PUBLIC" className="size-5 accent-rose-600" {...register('visibility')} />
            Public — lisible par tous les comptes connectés
          </label>
        </fieldset>
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
      <ConfirmDialog
        open={confirmPrivate !== null}
        title="Rendre ce pattern privé ?"
        message="Les autres comptes perdront l’accès à ce pattern et leur avancement."
        confirmLabel="Rendre privé"
        danger
        loading={save.isPending}
        onCancel={() => setConfirmPrivate(null)}
        onConfirm={() => {
          const values = confirmPrivate
          setConfirmPrivate(null)
          if (values) void persist(values)
        }}
      />
    </form>
  )
}
