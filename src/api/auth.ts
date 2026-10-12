import { api, ApiError } from './client'
import type { Account } from './types'

export interface Credentials {
  email: string
  password: string
}

export const fetchCsrf = () => api<void>('/api/auth/csrf')

export async function getMe(): Promise<Account | null> {
  try {
    return await api<Account>('/api/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export const register = (credentials: Credentials) =>
  api<Account>('/api/auth/register', { method: 'POST', body: credentials })

export const login = (credentials: Credentials) => api<Account>('/api/auth/login', { method: 'POST', body: credentials })

export const logout = () => api<void>('/api/auth/logout', { method: 'POST' })

export const changePassword = (body: { currentPassword: string; newPassword: string }) =>
  api<void>('/api/me/password', { method: 'PUT', body })

export const deleteAccount = (password: string) => api<void>('/api/me', { method: 'DELETE', body: { password } })
