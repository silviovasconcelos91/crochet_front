import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import { AppProviders } from '../app/AppProviders'
import { routes } from '../app/routes'

export function renderApp(path: string) {
  const queryClient = createQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, user, router, queryClient }
}
