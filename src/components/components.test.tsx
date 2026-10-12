import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import { TextField } from './TextField'
import { ToastProvider } from './toast/ToastProvider'
import { useToast } from './toast/useToast'

describe('TextField', () => {
  it('relie le message d’erreur au champ', () => {
    render(<TextField label="Email" error="Obligatoire" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Obligatoire')
  })
})

describe('ConfirmDialog', () => {
  it('confirme, annule et se ferme avec Échap', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog open title="Supprimer ?" message="Action définitive." confirmLabel="Supprimer" danger onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByRole('alertdialog', { name: 'Supprimer ?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('ne rend rien quand il est fermé', () => {
    render(<ConfirmDialog open={false} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Toast', () => {
  function Trigger() {
    const toast = useToast()
    return <button onClick={() => toast.show('Pattern supprimé', 'success')}>go</button>
  }

  it('affiche un toast puis le retire après 4 s', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByRole('status')).toHaveTextContent('Pattern supprimé')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Pattern supprimé')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
