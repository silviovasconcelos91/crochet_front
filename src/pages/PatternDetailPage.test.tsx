import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'
import { TAP_GUARD_MS } from './patternDetail/ProgressActions'

const row = (value: string) => screen.getByRole('button', { name: (name) => name.includes(value) })

/** Laisse passer la protection anti double appui de la barre d'action. */
const pauseAfterTap = () => new Promise((resolve) => setTimeout(resolve, TAP_GUARD_MS + 50))

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

    await pauseAfterTap()
    await user.click(await screen.findByRole('button', { name: /Terminer/ }))
    expect(await screen.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.status).toBe('FINISHED'))

    await pauseAfterTap()
    await user.click(screen.getByRole('button', { name: 'Rouvrir' }))
    expect(await screen.findByRole('button', { name: /Terminer/ })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.finishedAt).toBeNull())
  })

  it('ignore un double appui qui tomberait sur « Terminer »', async () => {
    const { user } = setup({ progress: progressAt(0, 1) })
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    await user.click(screen.getByRole('button', { name: /Terminer/ }))
    expect(screen.getByRole('button', { name: /Terminer/ })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns[0].progress).toMatchObject({ stepIndex: 1, rowIndex: 0 }))
    expect(db.patterns[0].progress?.status).toBe('IN_PROGRESS')
  })

  it('ignore un double appui qui tomberait sur « Rang suivant » après « Rouvrir »', async () => {
    const { user } = setup({ progress: progressAt(0, 0, 'FINISHED') })
    await user.click(await screen.findByRole('button', { name: 'Rouvrir' }))
    await user.click(screen.getByRole('button', { name: /Rang suivant/ }))
    expect(row('6ms dans cercle (6)')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns[0].progress?.status).toBe('IN_PROGRESS'))
    expect(db.patterns[0].progress?.rowIndex).toBe(0)
  })

  it('masque une image de détail cassée', async () => {
    setup({ imageUrl: 'https://ex.com/cassee.png' })
    await screen.findByRole('heading', { name: 'Lapin' })
    const image = document.querySelector('img')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
    fireEvent.error(image!)
    expect(document.querySelector('img')).toBeNull()
  })

  it('affiche « Pattern introuvable » si le pattern a été supprimé ailleurs', async () => {
    const { user } = setup({ progress: progressAt(0, 0) })
    await screen.findByRole('button', { name: /Rang suivant/ })
    db.patterns = []
    await user.click(screen.getByRole('button', { name: /Rang suivant/ }))
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
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

  it('se resynchronise avec le serveur si deux appuis en file échouent', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const account = seedAccount()
    const pattern = seedPattern(account.id, {
      steps: [{ title: 'Unique', rows: [{ number: '1', value: 'A1' }, { number: '2', value: 'A2' }, { number: '3', value: 'A3' }] }],
      progress: progressAt(0, 0),
    })
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), async () => {
      await gate
      return problem(500, 'Internal error')
    }))
    const { user } = renderApp(`/patterns/${pattern.id}`)
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    await user.click(screen.getByRole('button', { name: /Terminer|Rang suivant/ }))
    release()
    await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(2))
    await waitFor(() => expect(row('A1')).toHaveAttribute('aria-current', 'step'))
    expect(db.patterns[0].progress?.rowIndex).toBe(0)
  })

  it('se resynchronise après une 400 si le pattern a changé ailleurs', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 0) })
    await screen.findByRole('button', { name: /Rang suivant/ })
    // Raccourci depuis un autre appareil : l'étape 1 n'a plus qu'un rang.
    db.patterns[0].steps = [{ title: 'Tête', rows: [{ number: '1', value: '6ms dans cercle (6)' }] }]
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), () =>
      problem(400, 'Validation failed', { errors: [{ field: 'rowIndex', message: 'must be less than 1' }] }),
    ))
    await user.click(screen.getByRole('button', { name: /Rang suivant/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: (name) => name.includes('6aug (12)') })).not.toBeInTheDocument())
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
