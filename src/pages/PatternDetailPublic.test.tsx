import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { renderApp } from '../test/renderApp'

function seedOthersPublic() {
  const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
  const ana = seedAccount()
  const ours = seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC', progress: progressAt(1, 0) })
  return { ana, bob, ours }
}

describe('détail selon l’auteur', () => {
  it('affiche l’auteur et masque Modifier/Supprimer sur le pattern d’un autre', async () => {
    const { ours } = seedOthersPublic()
    const { user } = renderApp(`/patterns/${ours.id}`)
    expect(await screen.findByText('par bob')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions du pattern' }))
    expect(screen.queryByRole('menuitem', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Supprimer le pattern' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Écran toujours allumé' })).toBeInTheDocument()
  })

  it('permet de suivre son propre avancement sur le pattern public d’un autre', async () => {
    const { ana, ours } = seedOthersPublic()
    const { user } = renderApp(`/patterns/${ours.id}`)
    await user.click(await screen.findByRole('button', { name: 'Démarrer' }))
    await waitFor(() => expect(db.patterns[0].otherProgress[ana.id]).toMatchObject({ stepIndex: 0, rowIndex: 0 }))
    expect(db.patterns[0].progress).toMatchObject({ stepIndex: 1, rowIndex: 0 })
  })

  it('affiche Public et la mention des autres comptes à la suppression de mon pattern public', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    const { user } = renderApp(`/patterns/${lapin.id}`)
    expect(await screen.findByText('Public')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions du pattern' }))
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le pattern' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Le pattern, ton avancement et celui des autres comptes seront définitivement supprimés.',
    )
  })

  it('affiche Privé sur mon pattern privé, sans auteur', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id)
    renderApp(`/patterns/${lapin.id}`)
    expect(await screen.findByText('Privé')).toBeInTheDocument()
    expect(screen.queryByText(/^par /)).not.toBeInTheDocument()
  })
})
