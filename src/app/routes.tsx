import type { RouteObject } from 'react-router'
import { GuestOnly } from '../auth/GuestOnly'
import { RequireAuth } from '../auth/RequireAuth'
import { Layout } from '../components/Layout'
import { AccountPage } from '../pages/AccountPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PatternDetailPage } from '../pages/PatternDetailPage'
import { PatternFormPage } from '../pages/PatternFormPage'
import { PatternListPage } from '../pages/PatternListPage'
import { RegisterPage } from '../pages/RegisterPage'
import { Root } from './Root'
import { RouteError } from './RouteError'

export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <Layout />,
            children: [
              { path: '/', element: <PatternListPage /> },
              { path: '/patterns/new', element: <PatternFormPage /> },
              { path: '/patterns/:id', element: <PatternDetailPage /> },
              { path: '/patterns/:id/edit', element: <PatternFormPage /> },
              { path: '/account', element: <AccountPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
