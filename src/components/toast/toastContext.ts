import { createContext } from 'react'

export type ToastTone = 'error' | 'success' | 'info'

export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
