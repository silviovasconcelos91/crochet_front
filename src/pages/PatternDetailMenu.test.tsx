import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

function setup(overrides: Parameters<typeof seedPattern>[1] = {}) {
  const account = seedAccount()
  const pattern = seedPattern(account.id, overrides)
  return { pattern, ...renderApp(`/patterns/${pattern.id}`) }
}

async function openMenu(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Actions du pattern' }))
}

describe('menu du détail', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('abandonne l’avancement après confirmation', async () => {
    const { user } = setup({ progress: progressAt(0, 1) })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Abandonner l’avancement' }))
    await user.click(screen.getByRole('button', { name: 'Abandonner' }))
    expect(await screen.findByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
    expect(db.patterns[0].progress).toBeNull()
  })

  it('traite « is not started » comme un abandon réussi', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 1) })
    server.use(
      http.delete(apiUrl(`/api/patterns/${pattern.id}/progress`), () => problem(404, `Pattern ${pattern.id} is not started`)),
    )
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Abandonner l’avancement' }))
    await user.click(screen.getByRole('button', { name: 'Abandonner' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('supprime le pattern et revient à la liste', async () => {
    const { user } = setup()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le pattern' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(await screen.findByText('Pattern supprimé')).toBeInTheDocument()
    expect(db.patterns).toHaveLength(0)
  })

  it('termine depuis le menu au milieu du pattern', async () => {
    const { user } = setup({ progress: progressAt(0, 0) })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Terminer' }))
    expect(await screen.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument()
  })

  it('propose Modifier vers le formulaire', async () => {
    const { user, pattern } = setup()
    await openMenu(user)
    expect(screen.getByRole('menuitem', { name: 'Modifier' })).toHaveAttribute('href', `/patterns/${pattern.id}/edit`)
  })

  it('garde l’écran allumé en cours, et respecte l’interrupteur', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ released: false, release })
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })

    const { user } = setup({ progress: progressAt(0, 0) })
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))

    await openMenu(user)
    await user.click(screen.getByRole('checkbox', { name: 'Écran toujours allumé' }))
    await waitFor(() => expect(release).toHaveBeenCalled())
    expect(localStorage.getItem('crochet.keepAwake')).toBe('false')
  })
})
