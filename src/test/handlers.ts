import { http, HttpResponse, type PathParams } from 'msw'
import { API_URL } from '../api/client'
import type { ApiFieldError, Pattern, PatternInput, PatternSummary, ProgressInput } from '../api/types'
import { db, type DbAccount, type DbPattern } from './db'

export const apiUrl = (path: string) => `${API_URL}${path}`

const currentCsrfToken = () => `tok-${db.csrfCounter}`

/** Le serveur dépose un nouveau XSRF-TOKEN ; en test on l'écrit directement dans document.cookie. */
function issueCsrf(): void {
  db.csrfCounter += 1
  document.cookie = `XSRF-TOKEN=${currentCsrfToken()}; path=/`
}

export function problem(
  status: number,
  detail: string,
  init: { errors?: ApiFieldError[]; headers?: Record<string, string> } = {},
) {
  return HttpResponse.json(
    { type: 'about:blank', title: 'Error', status, detail, ...(init.errors ? { errors: init.errors } : {}) },
    { status, headers: { 'Content-Type': 'application/problem+json', ...init.headers } },
  )
}

const validation = (errors: ApiFieldError[]) => problem(400, 'Validation failed', { errors })

const csrfOk = (request: Request) =>
  db.csrfCounter > 0 && request.headers.get('X-XSRF-TOKEN') === currentCsrfToken()

const sessionAccount = () => db.accounts.find((account) => account.id === db.sessionAccountId)

const publicAccount = ({ id, email, createdAt }: DbAccount) => ({ id, email, createdAt })

function publicPattern(pattern: DbPattern): Pattern {
  const { ownerId: _ownerId, ...rest } = pattern
  return structuredClone(rest)
}

function toSummary(pattern: DbPattern): PatternSummary {
  const { id, title, description, hookSizeMm, yarn, imageUrl, progress } = pattern
  return { id, title, description, hookSizeMm, yarn, imageUrl, stepCount: pattern.steps.length, progress }
}

type Resolver = (args: { request: Request; params: PathParams; account: DbAccount }) => Response | Promise<Response>

function authed(resolver: Resolver) {
  return async ({ request, params }: { request: Request; params: PathParams }) => {
    if (request.method !== 'GET' && !csrfOk(request)) return problem(403, 'Access denied')
    const account = sessionAccount()
    if (!account) return problem(401, 'Authentication required')
    return resolver({ request, params, account })
  }
}

function csrfOnly(resolver: (request: Request) => Response | Promise<Response>) {
  return async ({ request }: { request: Request }) => (csrfOk(request) ? resolver(request) : problem(403, 'Access denied'))
}

function findOwned(params: PathParams, account: DbAccount): DbPattern | undefined {
  const id = Number(params.id)
  return db.patterns.find((pattern) => pattern.id === id && pattern.ownerId === account.id)
}

const notFound = (params: PathParams) => problem(404, `Pattern ${String(params.id)} not found`)

function validatePatternInput(input: PatternInput): ApiFieldError[] {
  const errors: ApiFieldError[] = []
  if (!input.title?.trim()) errors.push({ field: 'title', message: 'must not be blank' })
  if (!input.steps?.length) errors.push({ field: 'steps', message: 'must not be empty' })
  input.steps?.forEach((step, s) => {
    if (!step.title?.trim()) errors.push({ field: `steps[${s}].title`, message: 'must not be blank' })
    if (!step.rows?.length) errors.push({ field: `steps[${s}].rows`, message: 'must not be empty' })
    step.rows?.forEach((row, r) => {
      if (!row.number?.trim()) errors.push({ field: `steps[${s}].rows[${r}].number`, message: 'must not be blank' })
      if (!row.value?.trim()) errors.push({ field: `steps[${s}].rows[${r}].value`, message: 'must not be blank' })
    })
  })
  return errors
}

function applyInput(target: DbPattern, input: PatternInput): void {
  target.title = input.title
  target.description = input.description ?? null
  target.hookSizeMm = input.hookSizeMm ?? null
  target.yarn = input.yarn ?? null
  target.sourceUrl = input.sourceUrl ?? null
  target.imageUrl = input.imageUrl ?? null
  target.steps = input.steps.map((step) => ({
    title: step.title,
    rows: step.rows.map((row) => ({ number: row.number, value: row.value })),
  }))
  target.updatedAt = new Date().toISOString()
  if (target.progress) {
    // Recadrage comme le vrai backend
    const stepIndex = Math.min(target.progress.stepIndex, target.steps.length - 1)
    const rowIndex = Math.min(target.progress.rowIndex, target.steps[stepIndex].rows.length - 1)
    target.progress = { ...target.progress, stepIndex, rowIndex }
  }
}

export const handlers = [
  http.get(apiUrl('/api/auth/csrf'), () => {
    issueCsrf()
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(
    apiUrl('/api/auth/register'),
    csrfOnly(async (request) => {
      const body = (await request.json()) as { email?: string; password?: string }
      const email = (body.email ?? '').trim().toLowerCase()
      const password = body.password ?? ''
      const errors: ApiFieldError[] = []
      if (!email.includes('@')) errors.push({ field: 'email', message: 'must be a well-formed email address' })
      if (password.length < 8) errors.push({ field: 'password', message: 'size must be between 8 and 72' })
      if (errors.length > 0) return validation(errors)
      if (db.accounts.some((account) => account.email === email)) return problem(409, 'Email already used')
      const account: DbAccount = { id: db.nextId++, email, password, createdAt: new Date().toISOString() }
      db.accounts.push(account)
      db.sessionAccountId = account.id
      issueCsrf()
      return HttpResponse.json(publicAccount(account), { status: 201 })
    }),
  ),

  http.post(
    apiUrl('/api/auth/login'),
    csrfOnly(async (request) => {
      const body = (await request.json()) as { email?: string; password?: string }
      const email = (body.email ?? '').trim().toLowerCase()
      const account = db.accounts.find((a) => a.email === email && a.password === body.password)
      if (!account) return problem(401, 'Invalid email or password')
      db.sessionAccountId = account.id
      issueCsrf()
      return HttpResponse.json(publicAccount(account))
    }),
  ),

  http.post(
    apiUrl('/api/auth/logout'),
    csrfOnly(() => {
      db.sessionAccountId = null
      issueCsrf()
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(apiUrl('/api/me'), authed(({ account }) => HttpResponse.json(publicAccount(account)))),

  http.put(
    apiUrl('/api/me/password'),
    authed(async ({ request, account }) => {
      const body = (await request.json()) as { currentPassword?: string; newPassword?: string }
      if (body.currentPassword !== account.password) {
        return validation([{ field: 'currentPassword', message: 'is incorrect' }])
      }
      account.password = body.newPassword ?? ''
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.delete(
    apiUrl('/api/me'),
    authed(async ({ request, account }) => {
      const body = (await request.json()) as { password?: string }
      if (body.password !== account.password) return validation([{ field: 'password', message: 'is incorrect' }])
      db.accounts = db.accounts.filter((a) => a.id !== account.id)
      db.patterns = db.patterns.filter((p) => p.ownerId !== account.id)
      db.sessionAccountId = null
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    apiUrl('/api/patterns'),
    authed(({ account }) =>
      HttpResponse.json(
        db.patterns
          .filter((p) => p.ownerId === account.id)
          .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
          .map(toSummary),
      ),
    ),
  ),

  http.get(
    apiUrl('/api/patterns/:id'),
    authed(({ params, account }) => {
      const pattern = findOwned(params, account)
      return pattern ? HttpResponse.json(publicPattern(pattern)) : notFound(params)
    }),
  ),

  http.post(
    apiUrl('/api/patterns'),
    authed(async ({ request, account }) => {
      const input = (await request.json()) as PatternInput
      const errors = validatePatternInput(input)
      if (errors.length > 0) return validation(errors)
      const now = new Date().toISOString()
      const pattern: DbPattern = {
        id: db.nextId++,
        ownerId: account.id,
        title: '',
        description: null,
        hookSizeMm: null,
        yarn: null,
        sourceUrl: null,
        imageUrl: null,
        createdAt: now,
        updatedAt: now,
        steps: [],
        progress: null,
      }
      applyInput(pattern, input)
      db.patterns.push(pattern)
      return HttpResponse.json(publicPattern(pattern), {
        status: 201,
        headers: { Location: `/api/patterns/${pattern.id}` },
      })
    }),
  ),

  http.put(
    apiUrl('/api/patterns/:id'),
    authed(async ({ request, params, account }) => {
      const pattern = findOwned(params, account)
      if (!pattern) return notFound(params)
      const input = (await request.json()) as PatternInput
      const errors = validatePatternInput(input)
      if (errors.length > 0) return validation(errors)
      applyInput(pattern, input)
      return HttpResponse.json(publicPattern(pattern))
    }),
  ),

  http.delete(
    apiUrl('/api/patterns/:id'),
    authed(({ params, account }) => {
      const pattern = findOwned(params, account)
      if (!pattern) return notFound(params)
      db.patterns = db.patterns.filter((p) => p !== pattern)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.put(
    apiUrl('/api/patterns/:id/progress'),
    authed(async ({ request, params, account }) => {
      const pattern = findOwned(params, account)
      if (!pattern) return notFound(params)
      const input = (await request.json()) as ProgressInput
      if (input.status !== 'IN_PROGRESS' && input.status !== 'FINISHED') {
        return validation([{ field: 'status', message: 'must be one of [IN_PROGRESS, FINISHED]' }])
      }
      if (!(input.stepIndex >= 0 && input.stepIndex < pattern.steps.length)) {
        return validation([{ field: 'stepIndex', message: `must be less than ${pattern.steps.length}` }])
      }
      const rowCount = pattern.steps[input.stepIndex].rows.length
      if (!(input.rowIndex >= 0 && input.rowIndex < rowCount)) {
        return validation([{ field: 'rowIndex', message: `must be less than ${rowCount}` }])
      }
      const now = new Date().toISOString()
      const previous = pattern.progress
      pattern.progress = {
        status: input.status,
        stepIndex: input.stepIndex,
        rowIndex: input.rowIndex,
        startedAt: previous?.startedAt ?? now,
        updatedAt: now,
        finishedAt: input.status === 'FINISHED' ? (previous?.finishedAt ?? now) : null,
      }
      return HttpResponse.json(pattern.progress)
    }),
  ),

  http.delete(
    apiUrl('/api/patterns/:id/progress'),
    authed(({ params, account }) => {
      const pattern = findOwned(params, account)
      if (!pattern) return notFound(params)
      if (!pattern.progress) return problem(404, `Pattern ${pattern.id} is not started`)
      pattern.progress = null
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
