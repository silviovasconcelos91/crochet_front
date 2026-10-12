import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ToastProvider } from '../components/toast/ToastProvider'

export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
