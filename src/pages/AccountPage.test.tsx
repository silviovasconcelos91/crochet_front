import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, seedAccount, seedPattern } from '../test/db'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof renderApp>['user']

async function changePassword(user: User, current: string, next: string, confirm = next) {
  await user.type(await screen.findByLabelText('Mot de passe actuel'), current)
  await user.type(screen.getByLabelText('Nouveau mot de passe'), next)
  await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), confirm)
  await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))
}

describe('AccountPage', () => {
  it('affiche l’email et la date d’inscription', async () => {
    seedAccount()
    renderApp('/account')
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Inscrit le 12/10/2026')).toBeInTheDocument()
  })

  it('change le mot de passe', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'secret123', 'nouveau123')
    expect(await screen.findByText('Mot de passe modifié')).toBeInTheDocument()
    expect(db.accounts[0].password).toBe('nouveau123')
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('')
  })

  it('signale un mot de passe actuel incorrect sous le champ', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'mauvais', 'nouveau123')
    const field = screen.getByLabelText('Mot de passe actuel')
    await waitFor(() => expect(field).toHaveAccessibleDescription('Mot de passe incorrect'))
  })

  it('vérifie la confirmation côté client', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'secret123', 'nouveau123', 'autre123')
    expect(await screen.findByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts[0].password).toBe('secret123')
  })

  it('déconnecte et renvoie au login', async () => {
    seedAccount()
    const { user, router } = renderApp('/account')
    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(db.sessionAccountId).toBeNull()
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('permet de se reconnecter juste après la déconnexion', async () => {
    seedAccount()
    const { user, router } = renderApp('/account')
    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    await user.type(await screen.findByLabelText('Pseudo'), 'ana')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('refuse la suppression avec un mauvais mot de passe', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await user.type(await screen.findByLabelText('Mot de passe'), 'mauvais')
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    await waitFor(() => expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('Mot de passe incorrect'))
    expect(db.accounts).toHaveLength(1)
  })

  it('supprime le compte après confirmation', async () => {
    const account = seedAccount()
    seedPattern(account.id)
    const { user, router } = renderApp('/account')
    await user.type(await screen.findByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
    expect(db.accounts).toHaveLength(0)
    expect(db.patterns).toHaveLength(0)
  })
})
