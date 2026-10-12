import type { ApiFieldError, Problem } from './types'

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  readonly status: number
  readonly problem: Problem | null
  readonly fieldErrors: ApiFieldError[]
  readonly retryAfter: number | null

  constructor(status: number, problem: Problem | null, retryAfter: number | null) {
    super(problem?.detail ?? `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
    this.fieldErrors = problem?.errors ?? []
    this.retryAfter = retryAfter
  }
}

const XSRF_COOKIE = 'XSRF-TOKEN='

/** Lu à chaque requête : le serveur fait tourner le token (login, register, logout). */
export function readXsrfToken(): string | undefined {
  const entry = document.cookie.split('; ').find((cookie) => cookie.startsWith(XSRF_COOKIE))
  return entry ? decodeURIComponent(entry.slice(XSRF_COOKIE.length)) : undefined
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
}

export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await send(path, options)
  if (response.status === 403 && options.method !== undefined && options.method !== 'GET' && (await isCsrfDenial(response))) {
    // Cookie XSRF perdu ou périmé : on en redemande un et on rejoue une seule fois.
    await send('/api/auth/csrf', {})
    return parse<T>(await send(path, options))
  }
  return parse<T>(response)
}

async function send(path: string, { method = 'GET', body }: ApiOptions): Promise<Response> {
  const headers = new Headers({ Accept: 'application/json' })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  if (method !== 'GET') {
    const token = readXsrfToken()
    if (token) headers.set('X-XSRF-TOKEN', token)
  }
  try {
    return await fetch(API_URL + path, {
      method,
      headers,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, null, null)
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = response.status === 204 ? '' : await response.text().catch(() => '')
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }
  if (!response.ok) {
    throw new ApiError(response.status, isProblem(data) ? data : null, parseRetryAfter(response.headers.get('Retry-After')))
  }
  return (response.status === 204 ? undefined : data) as T
}

function isProblem(data: unknown): data is Problem {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}

function parseRetryAfter(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value.trim())) return null
  return Number(value.trim())
}

/** Une 403 CSRF a pour détail « Access denied » (ou pas de corps) ; les autres 403 sont métier. */
async function isCsrfDenial(response: Response): Promise<boolean> {
  const text = await response.clone().text().catch(() => '')
  if (!text) return true
  try {
    const data: unknown = JSON.parse(text)
    return !isProblem(data) || data.detail === 'Access denied'
  } catch {
    return true
  }
}
