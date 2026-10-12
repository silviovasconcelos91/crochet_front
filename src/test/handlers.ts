import { http, HttpResponse, type PathParams } from 'msw'
import { API_URL } from '../api/client'
import type { ApiFieldError, Pattern, PatternInput, PatternSummary, Progress, ProgressInput } from '../api/types'
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

const USERNAME = /^[\p{L}\p{N}_.-]{3,30}$/u
const USERNAME_MESSAGE = "must be 3 to 30 letters, digits, '_', '-' or '.'"
const sameUsername = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const publicAccount = ({ id, username, email, createdAt }: DbAccount) => ({ id, username, email, createdAt })

function progressFor(pattern: DbPattern, accountId: number): Progress | null {
  return accountId === pattern.ownerId ? pattern.progress : (pattern.otherProgress[accountId] ?? null)
}

function setProgressFor(pattern: DbPattern, accountId: number, progress: Progress | null): void {
  if (accountId === pattern.ownerId) pattern.progress = progress
  else if (progress) pattern.otherProgress[accountId] = progress
  else delete pattern.otherProgress[accountId]
}

/** Vue d'un pattern pour le compte connecté : son avancement, l'auteur, `mine`. */
function viewOf(pattern: DbPattern, account: DbAccount): Pattern {
  const { ownerId, otherProgress: _otherProgress, progress: _ownerProgress, ...rest } = pattern
  const owner = db.accounts.find((a) => a.id === ownerId)
  return structuredClone({
    ...rest,
    progress: progressFor(pattern, account.id),
    author: { username: owner?.username ?? 'inconnu' },
    mine: ownerId === account.id,
  })
}

function toSummary(pattern: DbPattern, account: DbAccount): PatternSummary {
  const view = viewOf(pattern, account)
  const { id, title, description, hookSizeMm, yarn, imageUrl, progress, visibility, author, mine } = view
  return { id, title, description, hookSizeMm, yarn, imageUrl, stepCount: view.steps.length, progress, visibility, author, mine }
}

const byTitle = (a: DbPattern, b: DbPattern) => a.title.toLowerCase().localeCompare(b.title.toLowerCase())

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

/** Lisible : le mien, ou public. */
function findVisible(params: PathParams, account: DbAccount): DbPattern | undefined {
  const id = Number(params.id)
  return db.patterns.find((p) => p.id === id && (p.ownerId === account.id || p.visibility === 'PUBLIC'))
}

const notFound = (params: PathParams) => problem(404, `Pattern ${String(params.id)} not found`)

/** Écriture : 404 si invisible, 403 si visible mais pas à moi. */
function findWritable(params: PathParams, account: DbAccount): DbPattern | Response {
  const pattern = findVisible(params, account)
  if (!pattern) return notFound(params)
  if (pattern.ownerId !== account.id) return problem(403, `Pattern ${pattern.id} belongs to another account`)
  return pattern
}

function validatePatternInput(input: PatternInput): ApiFieldError[] {
  const errors: ApiFieldError[] = []
  if (input.visibility !== undefined && input.visibility !== 'PRIVATE' && input.visibility !== 'PUBLIC') {
    errors.push({ field: 'visibility', message: 'must be one of [PRIVATE, PUBLIC]' })
  }
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
  // Contrat : omis = PRIVATE, y compris sur PUT. Repasser en privé efface l'avancement des autres.
  target.visibility = input.visibility ?? 'PRIVATE'
  if (target.visibility === 'PRIVATE') target.otherProgress = {}
  target.steps = input.steps.map((step) => ({
    title: step.title,
    rows: step.rows.map((row) => ({ number: row.number, value: row.value })),
  }))
  target.updatedAt = new Date().toISOString()
  // Recadrage de chaque avancement, comme le vrai backend
  const clamp = (progress: Progress): Progress => {
    const stepIndex = Math.min(progress.stepIndex, target.steps.length - 1)
    const rowIndex = Math.min(progress.rowIndex, target.steps[stepIndex].rows.length - 1)
    return { ...progress, stepIndex, rowIndex }
  }
  if (target.progress) target.progress = clamp(target.progress)
  for (const [accountId, progress] of Object.entries(target.otherProgress)) {
    target.otherProgress[Number(accountId)] = clamp(progress)
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
      const body = (await request.json()) as { username?: string; email?: string; password?: string }
      const username = (body.username ?? '').trim()
      const email = (body.email ?? '').trim().toLowerCase()
      const password = body.password ?? ''
      const errors: ApiFieldError[] = []
      if (!USERNAME.test(username)) errors.push({ field: 'username', message: USERNAME_MESSAGE })
      if (!email.includes('@')) errors.push({ field: 'email', message: 'must be a well-formed email address' })
      if (password.length < 8) errors.push({ field: 'password', message: 'size must be between 8 and 72' })
      if (errors.length > 0) return validation(errors)
      const taken: ApiFieldError[] = []
      if (db.accounts.some((a) => sameUsername(a.username, username))) taken.push({ field: 'username', message: 'is already used' })
      if (db.accounts.some((a) => a.email === email)) taken.push({ field: 'email', message: 'is already used' })
      if (taken.length > 0) return problem(409, 'Already used', { errors: taken })
      const account: DbAccount = { id: db.nextId++, username, email, password, createdAt: new Date().toISOString() }
      db.accounts.push(account)
      db.sessionAccountId = account.id
      issueCsrf()
      return HttpResponse.json(publicAccount(account), { status: 201 })
    }),
  ),

  http.post(
    apiUrl('/api/auth/login'),
    csrfOnly(async (request) => {
      const body = (await request.json()) as { username?: string; password?: string }
      const username = (body.username ?? '').trim()
      const account = db.accounts.find((a) => sameUsername(a.username, username) && a.password === body.password)
      if (!account) return problem(401, 'Invalid username or password')
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

  http.put(
    apiUrl('/api/me/username'),
    authed(async ({ request, account }) => {
      const body = (await request.json()) as { username?: string; currentPassword?: string }
      const username = (body.username ?? '').trim()
      if (!USERNAME.test(username)) return validation([{ field: 'username', message: USERNAME_MESSAGE }])
      if (body.currentPassword !== account.password) {
        return validation([{ field: 'currentPassword', message: 'is incorrect' }])
      }
      if (db.accounts.some((a) => a.id !== account.id && sameUsername(a.username, username))) {
        return problem(409, 'Already used', { errors: [{ field: 'username', message: 'is already used' }] })
      }
      account.username = username
      return HttpResponse.json(publicAccount(account))
    }),
  ),

  http.delete(
    apiUrl('/api/me'),
    authed(async ({ request, account }) => {
      const body = (await request.json()) as { password?: string }
      if (body.password !== account.password) return validation([{ field: 'password', message: 'is incorrect' }])
      db.accounts = db.accounts.filter((a) => a.id !== account.id)
      db.patterns = db.patterns.filter((p) => p.ownerId !== account.id)
      for (const pattern of db.patterns) delete pattern.otherProgress[account.id]
      db.sessionAccountId = null
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.get(
    apiUrl('/api/patterns'),
    authed(({ account }) =>
      HttpResponse.json(db.patterns.filter((p) => p.ownerId === account.id).sort(byTitle).map((p) => toSummary(p, account))),
    ),
  ),

  // Déclaré avant /api/patterns/:id, sinon « public » serait pris pour un id.
  http.get(
    apiUrl('/api/patterns/public'),
    authed(({ account }) =>
      HttpResponse.json(db.patterns.filter((p) => p.visibility === 'PUBLIC').sort(byTitle).map((p) => toSummary(p, account))),
    ),
  ),

  http.get(
    apiUrl('/api/patterns/:id'),
    authed(({ params, account }) => {
      const pattern = findVisible(params, account)
      return pattern ? HttpResponse.json(viewOf(pattern, account)) : notFound(params)
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
        otherProgress: {},
        title: '',
        description: null,
        hookSizeMm: null,
        yarn: null,
        sourceUrl: null,
        imageUrl: null,
        visibility: 'PRIVATE',
        createdAt: now,
        updatedAt: now,
        steps: [],
        progress: null,
      }
      applyInput(pattern, input)
      db.patterns.push(pattern)
      return HttpResponse.json(viewOf(pattern, account), {
        status: 201,
        headers: { Location: `/api/patterns/${pattern.id}` },
      })
    }),
  ),

  http.put(
    apiUrl('/api/patterns/:id'),
    authed(async ({ request, params, account }) => {
      const pattern = findWritable(params, account)
      if (pattern instanceof Response) return pattern
      const input = (await request.json()) as PatternInput
      const errors = validatePatternInput(input)
      if (errors.length > 0) return validation(errors)
      applyInput(pattern, input)
      return HttpResponse.json(viewOf(pattern, account))
    }),
  ),

  http.delete(
    apiUrl('/api/patterns/:id'),
    authed(({ params, account }) => {
      const pattern = findWritable(params, account)
      if (pattern instanceof Response) return pattern
      db.patterns = db.patterns.filter((p) => p !== pattern)
      return new HttpResponse(null, { status: 204 })
    }),
  ),

  http.put(
    apiUrl('/api/patterns/:id/progress'),
    authed(async ({ request, params, account }) => {
      const pattern = findVisible(params, account)
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
      const previous = progressFor(pattern, account.id)
      const progress: Progress = {
        status: input.status,
        stepIndex: input.stepIndex,
        rowIndex: input.rowIndex,
        startedAt: previous?.startedAt ?? now,
        updatedAt: now,
        finishedAt: input.status === 'FINISHED' ? (previous?.finishedAt ?? now) : null,
      }
      setProgressFor(pattern, account.id, progress)
      return HttpResponse.json(progress)
    }),
  ),

  http.delete(
    apiUrl('/api/patterns/:id/progress'),
    authed(({ params, account }) => {
      const pattern = findVisible(params, account)
      if (!pattern) return notFound(params)
      if (!progressFor(pattern, account.id)) return problem(404, `Pattern ${pattern.id} is not started`)
      setProgressFor(pattern, account.id, null)
      return new HttpResponse(null, { status: 204 })
    }),
  ),
]
