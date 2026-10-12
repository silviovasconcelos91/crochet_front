import { api } from './client'
import type { Pattern, PatternInput, PatternSummary, Progress, ProgressInput } from './types'

export const listPatterns = () => api<PatternSummary[]>('/api/patterns')

export const listPublicPatterns = () => api<PatternSummary[]>('/api/patterns/public')

export const getPattern = (id: number) => api<Pattern>(`/api/patterns/${id}`)

export const createPattern = (input: PatternInput) => api<Pattern>('/api/patterns', { method: 'POST', body: input })

export const updatePattern = (id: number, input: PatternInput) =>
  api<Pattern>(`/api/patterns/${id}`, { method: 'PUT', body: input })

export const deletePattern = (id: number) => api<void>(`/api/patterns/${id}`, { method: 'DELETE' })

export const putProgress = (id: number, input: ProgressInput) =>
  api<Progress>(`/api/patterns/${id}/progress`, { method: 'PUT', body: input })

export const deleteProgress = (id: number) => api<void>(`/api/patterns/${id}/progress`, { method: 'DELETE' })
