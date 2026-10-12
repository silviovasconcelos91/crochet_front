import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

const row = (value: string) => screen.getByRole('button', { name: (name) => name.includes(value) })

/** Steps par défaut : Tête [6ms dans cercle (6), 6aug (12)], Corps [12ms (12)]. */
function setup(overrides: Parameters<typeof seedPattern>[1] = {}) {
  const account = seedAccount()
  const pattern = seedPattern(account.id, overrides)
  return { pattern, ...renderApp(`/patterns/${pattern.id}`) }
}

describe('PatternDetailPage', () => {
  it('démarre un pattern non commencé', async () => {
    const { user, pattern } = setup()
    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByRole('button', { name: /Rang suivant/ })).toBeInTheDocument()
    expect(row('6ms dans cercle (6)')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress).toMatchObject({ stepIndex: 0, rowIndex: 0 }))
  })

  it('passe d’une étape à l’autre, termine puis rouvre', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 1) })
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(row('12ms (12)')).toHaveAttribute('aria-current', 'step')

    await user.click(await screen.findByRole('button', { name: /Terminer/ }))
    expect(await screen.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.status).toBe('FINISHED'))

    await user.click(screen.getByRole('button', { name: 'Rouvrir' }))
    expect(await screen.findByRole('button', { name: /Terminer/ })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.finishedAt).toBeNull())
  })

  it('désactive Précédent au premier rang et recule ensuite', async () => {
    const { user } = setup({ progress: progressAt(1, 0) })
    await user.click(await screen.findByRole('button', { name: 'Rang précédent' }))
    expect(row('6aug (12)')).toHaveAttribute('aria-current', 'step')
    await user.click(screen.getByRole('button', { name: 'Rang précédent' }))
    expect(screen.getByRole('button', { name: 'Rang précédent' })).toBeDisabled()
  })

  it('met l’UI à jour avant la réponse du serveur', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { user, pattern } = setup({ progress: progressAt(0, 0) })
    // Retient la requête puis la laisse passer au handler par défaut (le resolver ne renvoie rien).
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), async () => {
      await gate
    }))
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(row('6aug (12)')).toHaveAttribute('aria-current', 'step')
    expect(db.patterns[0].progress?.rowIndex).toBe(0)
    release()
    await waitFor(() => expect(db.patterns[0].progress?.rowIndex).toBe(1))
  })

  it('annule et affiche un toast si le serveur échoue', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 0) })
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), () => problem(500, 'Internal error')))
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur inattendue, réessaie plus tard')
    expect(row('6ms dans cercle (6)')).toHaveAttribute('aria-current', 'step')
  })

  it('encaisse un double appui rapide', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id, {
      steps: [{ title: 'Unique', rows: [{ number: '1', value: 'A1' }, { number: '2', value: 'A2' }, { number: '3', value: 'A3' }] }],
      progress: progressAt(0, 0),
    })
    const { user } = renderApp(`/patterns/${pattern.id}`)
    const next = await screen.findByRole('button', { name: /Rang suivant/ })
    await user.click(next)
    await user.click(screen.getByRole('button', { name: /Terminer|Rang suivant/ }))
    expect(row('A3')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns[0].progress?.rowIndex).toBe(2))
    expect(row('A3')).toHaveAttribute('aria-current', 'step')
  })

  it('touche un rang pour en faire la position courante', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: (name) => name.includes('12ms (12)') }))
    expect(row('12ms (12)')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns[0].progress).toMatchObject({ status: 'IN_PROGRESS', stepIndex: 1, rowIndex: 0 }))
  })

  it('affiche « Pattern introuvable » sur une 404', async () => {
    seedAccount()
    renderApp('/patterns/999')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
  })

  it('affiche « Pattern introuvable » pour un id invalide, sans appel API', async () => {
    seedAccount()
    let calls = 0
    server.use(http.get(apiUrl('/api/patterns/:id'), () => {
      calls += 1
    }))
    renderApp('/patterns/abc')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('ne rend pas de lien ni d’image pour une URL non http(s)', async () => {
    setup({ sourceUrl: 'javascript:alert(1)', imageUrl: 'javascript:alert(2)' })
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(screen.queryByRole('link', { name: /Source/ })).not.toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('rend la source http(s) en lien externe', async () => {
    setup({ sourceUrl: 'https://ex.com/lapin', hookSizeMm: 3.5, yarn: 'Coton' })
    expect(await screen.findByRole('link', { name: /Source/ })).toHaveAttribute('href', 'https://ex.com/lapin')
    expect(screen.getByText('Crochet 3,5 mm · Coton')).toBeInTheDocument()
  })
})
