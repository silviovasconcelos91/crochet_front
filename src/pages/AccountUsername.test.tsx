import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof renderApp>['user']

async function changeUsername(user: User, username: string, password: string) {
  await user.type(await screen.findByLabelText('Nouveau pseudo'), username)
  await user.type(screen.getByLabelText('Confirme avec ton mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Changer de pseudo' }))
}

describe('pseudo', () => {
  it('affiche le pseudo dans le compte et dans la barre du haut', async () => {
    seedAccount()
    renderApp('/account')
    expect(await within(await screen.findByRole('main')).findByText('@ana')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compte (@ana)' })).toHaveAttribute('href', '/account')
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('change le pseudo et met à jour l’affichage', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'ana_crochet', 'secret123')
    expect(await screen.findByText('Pseudo modifié')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compte (@ana_crochet)' })).toBeInTheDocument()
    expect(db.accounts[0].username).toBe('ana_crochet')
    expect(screen.getByLabelText('Nouveau pseudo')).toHaveValue('')
  })

  it('signale un pseudo déjà pris sous le champ', async () => {
    seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'BOB', 'secret123')
    await waitFor(() => expect(screen.getByLabelText('Nouveau pseudo')).toHaveAccessibleDescription('Ce pseudo est déjà pris'))
  })

  it('signale un mot de passe incorrect sous le champ', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'ana_crochet', 'mauvais')
    await waitFor(() =>
      expect(screen.getByLabelText('Confirme avec ton mot de passe')).toHaveAccessibleDescription('Mot de passe incorrect'),
    )
    expect(db.accounts[0].username).toBe('ana')
  })

  it('valide le pseudo côté client', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'a b', 'secret123')
    expect(await screen.findByText('3 à 30 caractères : lettres, chiffres, _ - .')).toBeInTheDocument()
    expect(db.accounts[0].username).toBe('ana')
  })
})
