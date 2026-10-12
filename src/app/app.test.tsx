import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { seedAccount } from '../test/db'
import { apiUrl } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

describe('démarrage et gardes', () => {
  it('redirige un visiteur vers le login avec redirect', async () => {
    const { router } = renderApp('/account')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2Faccount')
  })

  it('pose le cookie XSRF au démarrage', async () => {
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(document.cookie).toContain('XSRF-TOKEN=tok-1')
  })

  it('renvoie un utilisateur connecté de /login vers redirect', async () => {
    seedAccount()
    const { router } = renderApp('/login?redirect=%2Faccount')
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('ignore un redirect externe', async () => {
    seedAccount()
    const { router } = renderApp('/login?redirect=%2F%2Fevil.example')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('affiche la 404 pour une route inconnue', async () => {
    renderApp('/nimporte/quoi')
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
  })

  it('affiche une erreur de démarrage avec Réessayer si le serveur est injoignable', async () => {
    server.use(http.get(apiUrl('/api/auth/csrf'), () => HttpResponse.error()))
    renderApp('/')
    expect(await screen.findByText('Serveur injoignable, vérifie ta connexion', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
