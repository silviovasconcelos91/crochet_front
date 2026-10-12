import { screen, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

function seedThree() {
  const account = seedAccount()
  seedPattern(account.id, { title: 'Chat' })
  seedPattern(account.id, { title: 'Ours', progress: progressAt(1, 0), hookSizeMm: 3.5, yarn: 'Coton' })
  seedPattern(account.id, { title: 'Abeille', progress: progressAt(1, 0, 'FINISHED') })
}

describe('PatternListPage', () => {
  it('liste les patterns avec leur état', async () => {
    seedThree()
    renderApp('/')
    const items = await screen.findAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['Abeille', 'Chat', 'Ours'])
    expect(screen.getByText('Non commencé')).toBeInTheDocument()
    expect(screen.getByText('En cours · étape 2/2')).toBeInTheDocument()
    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText('3,5 mm · Coton')).toBeInTheDocument()
  })

  it('filtre côté client', async () => {
    seedThree()
    const { user } = renderApp('/')
    await screen.findAllByRole('listitem')
    await user.click(screen.getByRole('button', { name: 'En cours' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Ours' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Non commencés' }))
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument()
  })

  it('affiche un état vide avec une invitation', async () => {
    seedAccount()
    renderApp('/')
    expect(await screen.findByText('Aucun pattern pour l’instant.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer mon premier pattern' })).toHaveAttribute('href', '/patterns/new')
  })

  it('renvoie au login sur une 401', async () => {
    seedAccount()
    server.use(http.get(apiUrl('/api/patterns'), () => problem(401, 'Authentication required')))
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?redirect=%2F')
  })

  it('ouvre la création via le bouton +', async () => {
    seedAccount()
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Nouveau pattern' })).toHaveAttribute('href', '/patterns/new')
  })
})
