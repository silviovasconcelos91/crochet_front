import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { applyServerErrors, fieldLabel, firstErrorPath, splitFieldErrors, toFormPath } from './formErrors'

describe('toFormPath', () => {
  it.each([
    ['title', 'title'],
    ['steps[0].title', 'steps.0.title'],
    ['steps[0].rows[1].value', 'steps.0.rows.1.value'],
  ])('%s → %s', (input, expected) => {
    expect(toFormPath(input)).toBe(expected)
  })
})

describe('splitFieldErrors', () => {
  const values = { title: '', steps: [{ title: 'A', rows: [{ number: '1', value: '' }] }] }

  it('sépare les champs connus des autres', () => {
    const result = splitFieldErrors(
      [
        { field: 'title', message: 'must not be blank' },
        { field: 'steps[0].rows[0].value', message: 'must not be blank' },
        { field: 'steps', message: 'must not be empty' },
        { field: 'unknown', message: 'nope' },
      ],
      values,
    )
    expect(result.fields).toEqual([
      { path: 'title', message: 'must not be blank' },
      { path: 'steps.0.rows.0.value', message: 'must not be blank' },
    ])
    expect(result.others).toEqual([
      { field: 'steps', message: 'must not be empty' },
      { field: 'unknown', message: 'nope' },
    ])
  })
})

describe('firstErrorPath', () => {
  it('trouve le premier champ en erreur, même imbriqué', () => {
    const errors = {
      steps: [undefined, { rows: [undefined, { value: { type: 'validate', message: 'Obligatoire' } }] }],
    }
    expect(firstErrorPath(errors)).toBe('steps.1.rows.1.value')
  })
  it('renvoie null sans erreur', () => {
    expect(firstErrorPath({})).toBeNull()
  })
})

describe('applyServerErrors', () => {
  const makeForm = (values: Record<string, unknown>) => ({
    setError: vi.fn(),
    setFocus: vi.fn(),
    getValues: () => values,
    formState: { errors: {} },
  })

  it('pose les erreurs traduites sur les champs et renvoie les autres pour le bandeau', () => {
    const form = makeForm({ password: '' })
    const error = new ApiError(400, {
      status: 400,
      detail: 'Validation failed',
      errors: [
        { field: 'password', message: 'is incorrect' },
        { field: 'steps', message: 'must not be empty' },
      ],
    }, null)

    const banner = applyServerErrors(error, form as never)

    expect(form.setError).toHaveBeenCalledWith('password', { type: 'server', message: 'Mot de passe incorrect' })
    expect(banner).toBe('Étapes : Ne doit pas être vide')
  })

  it.each([
    ['steps', 'Étapes'],
    ['steps[1].rows', 'Rangs de l’étape 2'],
    ['steps[0].rows[2].value', 'Instructions du rang 3 de l’étape 1'],
    ['steps[0].rows[2].number', 'Numéro du rang 3 de l’étape 1'],
    ['steps[3].title', 'Titre de l’étape 4'],
    ['hookSizeMm', 'Taille du crochet'],
    ['inconnu', 'inconnu'],
  ])('fieldLabel(%s) = %s', (field, expected) => {
    expect(fieldLabel(field)).toBe(expected)
  })

  it('traduit une 409 selon le champ', () => {
    const form = makeForm({ username: '', email: '' })
    const error = new ApiError(409, {
      status: 409,
      detail: 'Already used',
      errors: [
        { field: 'username', message: 'is already used' },
        { field: 'email', message: 'is already used' },
      ],
    }, null)
    expect(applyServerErrors(error, form as never)).toBeNull()
    expect(form.setError).toHaveBeenCalledWith('username', { type: 'server', message: 'Ce pseudo est déjà pris' })
    expect(form.setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Cet email est déjà utilisé' })
  })

  it('renvoie null quand toutes les erreurs ont un champ', () => {
    const form = makeForm({ title: '' })
    const error = new ApiError(400, { errors: [{ field: 'title', message: 'must not be blank' }] }, null)
    expect(applyServerErrors(error, form as never)).toBeNull()
  })

  it('renvoie le message générique sans erreurs de champs', () => {
    const form = makeForm({})
    expect(applyServerErrors(new ApiError(429, null, 30), form as never)).toBe('Trop de tentatives, réessaie dans 30 s')
    expect(applyServerErrors(new Error('x'), form as never)).toBe('Erreur inattendue, réessaie plus tard')
  })
})
