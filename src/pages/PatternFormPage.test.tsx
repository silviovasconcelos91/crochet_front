import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

type User = ReturnType<typeof renderApp>['user']

async function fillMinimal(user: User) {
  await user.type(await screen.findByLabelText('Titre *'), 'Lapin')
  await user.type(screen.getByLabelText('Titre de l’étape 1'), 'Tête')
  await user.type(screen.getByLabelText('Numéro du rang 1 de l’étape 1'), '1')
  await user.type(screen.getByLabelText('Instructions du rang 1 de l’étape 1'), '6ms (6)')
}

describe('création', () => {
  it('crée un pattern et ouvre son détail', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.type(screen.getByLabelText('Taille du crochet (mm)'), '3,5')
    await user.click(screen.getByRole('button', { name: 'Ajouter un rang à l’étape 1' }))
    expect(screen.getByLabelText('Numéro du rang 2 de l’étape 1')).toHaveValue('2')
    expect(screen.getByLabelText('Instructions du rang 2 de l’étape 1')).toHaveFocus()
    await user.type(screen.getByLabelText('Instructions du rang 2 de l’étape 1'), '6aug (12)')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(db.patterns[0]).toMatchObject({
      title: 'Lapin',
      hookSizeMm: 3.5,
      description: null,
      yarn: null,
      steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms (6)' }, { number: '2', value: '6aug (12)' }] }],
    })
  })

  it('valide côté client et met le focus sur le premier champ en erreur', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findAllByText('Obligatoire')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByLabelText('Titre *')).toHaveFocus())
    expect(db.patterns).toHaveLength(0)
  })

  it('refuse une taille de crochet invalide', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.type(screen.getByLabelText('Taille du crochet (mm)'), '3,555')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Nombre positif, 2 décimales max (ex : 3,5)')).toBeInTheDocument()
  })

  it('affiche les erreurs serveur sur le bon champ et les autres dans le bandeau', async () => {
    seedAccount()
    server.use(
      http.post(apiUrl('/api/patterns'), () =>
        problem(400, 'Validation failed', {
          errors: [
            { field: 'steps[0].rows[0].value', message: 'must not be blank' },
            { field: 'steps', message: 'must not be empty' },
          ],
        }),
      ),
    )
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const field = screen.getByLabelText('Instructions du rang 1 de l’étape 1')
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(field).toHaveAccessibleDescription('Obligatoire')
    expect(screen.getByRole('alert')).toHaveTextContent('Ne doit pas être vide')
  })

  it('ajoute une étape avec un rang vide', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.click(await screen.findByRole('button', { name: 'Ajouter une étape' }))
    expect(screen.getByLabelText('Titre de l’étape 2')).toHaveValue('')
    expect(screen.getByLabelText('Numéro du rang 1 de l’étape 2')).toHaveValue('')
  })

  it('demande confirmation avant de quitter avec des modifications', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.type(await screen.findByLabelText('Titre *'), 'X')
    await user.click(screen.getByRole('link', { name: 'Retour' }))
    expect(screen.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByLabelText('Titre *')).toHaveValue('X')
    await user.click(screen.getByRole('link', { name: 'Retour' }))
    await user.click(screen.getByRole('button', { name: 'Quitter' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
  })

  it('redirige vers le login sans dialogue si la session a expiré', async () => {
    seedAccount()
    server.use(http.post(apiUrl('/api/patterns'), () => problem(401, 'Authentication required')))
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('propose de restaurer la saisie perdue sur une session expirée', async () => {
    seedAccount()
    server.use(http.post(apiUrl('/api/patterns'), () => problem(401, 'Authentication required')))
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    await user.click(await screen.findByRole('button', { name: 'Restaurer' }))
    expect(screen.getByLabelText('Titre *')).toHaveValue('Lapin')
    expect(screen.getByLabelText('Instructions du rang 1 de l’étape 1')).toHaveValue('6ms (6)')
    expect(screen.queryByRole('button', { name: 'Restaurer' })).not.toBeInTheDocument()
  })

  it('peut ignorer le brouillon retrouvé', async () => {
    seedAccount()
    sessionStorage.setItem('crochet.draft:new', JSON.stringify({ title: 'Ancien', steps: [] }))
    const { user } = renderApp('/patterns/new')
    await user.click(await screen.findByRole('button', { name: 'Ignorer' }))
    expect(screen.getByLabelText('Titre *')).toHaveValue('')
    expect(sessionStorage.getItem('crochet.draft:new')).toBeNull()
  })
})

describe('édition', () => {
  it('revient au détail sans doublon d’historique après enregistrement', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id)
    const { user, router } = renderApp(`/patterns/${pattern.id}`)
    await user.click(await screen.findByRole('button', { name: 'Actions du pattern' }))
    await user.click(screen.getByRole('menuitem', { name: 'Modifier' }))
    const title = await screen.findByLabelText('Titre *')
    await user.clear(title)
    await user.type(title, 'Lapin rose')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Lapin rose' })).toBeInTheDocument()
    expect(router.state.historyAction).toBe('POP')
    expect(router.state.location.pathname).toBe(`/patterns/${pattern.id}`)
  })

  it('pré-remplit, modifie et enregistre le pattern complet', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id, { hookSizeMm: 3.5, progress: progressAt(0, 1) })
    const { user } = renderApp(`/patterns/${pattern.id}/edit`)

    const title = await screen.findByLabelText('Titre *')
    expect(title).toHaveValue('Lapin')
    expect(screen.getByLabelText('Taille du crochet (mm)')).toHaveValue('3,5')
    expect(screen.getByText(/l’avancement sera recalé/)).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'Lapin bleu')
    await user.click(screen.getByRole('button', { name: 'Supprimer le rang 2 de l’étape 1' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: 'Lapin bleu' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(db.patterns[0].steps[0].rows).toHaveLength(1)
    expect(db.patterns[0].progress).toMatchObject({ stepIndex: 0, rowIndex: 0 })
  })

  it('réordonne les étapes', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id)
    const { user } = renderApp(`/patterns/${pattern.id}/edit`)
    await user.click(await screen.findByRole('button', { name: 'Descendre l’étape 1' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].steps.map((step) => step.title)).toEqual(['Corps', 'Tête'])
    expect(db.patterns[0].steps[0].rows).toEqual([{ number: '1', value: '12ms (12)' }])
    expect(db.patterns[0].steps[1].rows.map((row) => row.value)).toEqual(['6ms dans cercle (6)', '6aug (12)'])
  })

  it('affiche « Pattern introuvable » pour un pattern inexistant', async () => {
    seedAccount()
    renderApp('/patterns/999/edit')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
  })
})
