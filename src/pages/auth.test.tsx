import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

describe('LoginPage', () => {
  it('connecte puis redirige vers redirect', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2Faccount')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('affiche une erreur sur de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect')
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('affiche le délai d’attente en cas de 429', async () => {
    server.use(
      http.post(apiUrl('/api/auth/login'), () =>
        problem(429, 'Too many attempts, try again later', { headers: { 'Retry-After': '600' } }),
      ),
    )
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans 10 min')
  })

  it('ne suit pas un redirect externe après connexion', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2F%5Cevil.example')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('RegisterPage', () => {
  async function fill(user: ReturnType<typeof renderApp>['user'], email: string, password: string, confirm = password) {
    await user.type(await screen.findByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  }

  it('crée le compte et arrive sur la liste', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(db.accounts).toHaveLength(1)
  })

  it('affiche la 409 sous le champ email', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'secret123')
    expect(await screen.findByText('Cet email est déjà utilisé')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('valide côté client sans appeler l’API', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'court', 'autre')
    expect(await screen.findByText('Au moins 8 caractères')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts).toHaveLength(0)
  })
})
