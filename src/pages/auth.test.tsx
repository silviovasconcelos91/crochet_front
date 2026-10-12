import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

type User = ReturnType<typeof renderApp>['user']

async function logIn(user: User, username: string, password: string) {
  await user.type(await screen.findByLabelText('Pseudo'), username)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('LoginPage', () => {
  it('connecte par pseudo puis redirige vers redirect', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2Faccount')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('accepte le pseudo dans une autre casse', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await logIn(user, 'ANA', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
  })

  it('affiche une erreur sur de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await logIn(user, 'ana', 'mauvais')
    expect(await screen.findByRole('alert')).toHaveTextContent('Pseudo ou mot de passe incorrect')
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('n’a plus de champ email', async () => {
    renderApp('/login')
    await screen.findByLabelText('Pseudo')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('affiche le délai d’attente en cas de 429', async () => {
    server.use(
      http.post(apiUrl('/api/auth/login'), () =>
        problem(429, 'Too many attempts, try again later', { headers: { 'Retry-After': '600' } }),
      ),
    )
    const { user } = renderApp('/login')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans 10 min')
  })

  it('ne suit pas un redirect externe après connexion', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2F%5Cevil.example')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('RegisterPage', () => {
  async function fill(user: User, username: string, email: string, password: string, confirm = password) {
    await user.type(await screen.findByLabelText('Pseudo'), username)
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  }

  it('crée le compte avec le pseudo saisi et arrive sur la liste', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'Éloïse', 'eloise@example.com', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(db.accounts[0]).toMatchObject({ username: 'Éloïse', email: 'eloise@example.com' })
  })

  it('affiche la 409 sous le pseudo et sous l’email', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/register')
    await fill(user, 'ANA', 'ana@example.com', 'secret123')
    expect(await screen.findByText('Ce pseudo est déjà pris')).toBeInTheDocument()
    expect(screen.getByText('Cet email est déjà utilisé')).toBeInTheDocument()
    expect(screen.getByLabelText('Pseudo')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('valide côté client sans appeler l’API', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'a b', 'ana@example.com', 'court', 'autre')
    expect(await screen.findByText('3 à 30 caractères : lettres, chiffres, _ - .')).toBeInTheDocument()
    expect(screen.getByText('Au moins 8 caractères')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts).toHaveLength(0)
  })
})
