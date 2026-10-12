import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern, seedProgress } from '../test/db'
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

describe('visibilité', () => {
  it('crée en privé par défaut', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    expect(screen.getByRole('radio', { name: /^Privé/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].visibility).toBe('PRIVATE')
  })

  it('crée en public si on le choisit', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('radio', { name: /^Public/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].visibility).toBe('PUBLIC')
  })

  it('garde un pattern public en public quand on l’édite sans toucher à la visibilité', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)
    const title = await screen.findByLabelText('Titre *')
    await user.type(title, ' bleu')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Lapin bleu' })).toBeInTheDocument()
    expect(db.patterns[0].visibility).toBe('PUBLIC')
  })

  it('demande confirmation avant de repasser en privé, et Annuler n’envoie rien', async () => {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    seedProgress(lapin, bob.id, progressAt(0, 0))
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)

    await user.click(await screen.findByRole('radio', { name: /^Privé/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.getByRole('alertdialog', { name: 'Rendre ce pattern privé ?' })).toHaveTextContent(
      'Les autres comptes perdront l’accès à ce pattern et leur avancement.',
    )
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(db.patterns[0].visibility).toBe('PUBLIC')
    expect(screen.getByLabelText('Titre *')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await user.click(screen.getByRole('button', { name: 'Rendre privé' }))
    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    expect(db.patterns[0].visibility).toBe('PRIVATE')
    expect(db.patterns[0].otherProgress).toEqual({})
  })

  it('refuse d’ouvrir le formulaire sur le pattern d’un autre', async () => {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    seedAccount()
    const ours = seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC' })
    renderApp(`/patterns/${ours.id}/edit`)
    expect(await screen.findByRole('heading', { name: 'Seul l’auteur peut modifier ce pattern' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au pattern' })).toHaveAttribute('href', `/patterns/${ours.id}`)
    expect(screen.queryByLabelText('Titre *')).not.toBeInTheDocument()
  })

  it('affiche la 403 « autre compte » dans le bandeau, sans nouvel essai CSRF', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id)
    let csrfCalls = 0
    server.use(
      http.get(apiUrl('/api/auth/csrf'), () => {
        csrfCalls += 1
      }),
      http.put(apiUrl(`/api/patterns/${lapin.id}`), () => problem(403, `Pattern ${lapin.id} belongs to another account`)),
    )
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)
    await screen.findByLabelText('Titre *')
    const callsAfterBoot = csrfCalls
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pattern appartient à un autre compte')
    expect(csrfCalls).toBe(callsAfterBoot)
  })
})
