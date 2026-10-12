import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_URL, api, ApiError } from './client'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })
}

function call(index: number) {
  const [url, init] = fetchMock.mock.calls[index]
  return { url: String(url), init: init ?? {}, headers: new Headers(init?.headers) }
}

describe('api', () => {
  it('fait un GET avec les cookies et sans en-tête CSRF', async () => {
    document.cookie = 'XSRF-TOKEN=abc; path=/'
    fetchMock.mockResolvedValueOnce(json(200, { id: 1 }))

    await expect(api('/api/me')).resolves.toEqual({ id: 1 })

    expect(call(0).url).toBe(`${API_URL}/api/me`)
    expect(call(0).init.credentials).toBe('include')
    expect(call(0).init.method).toBe('GET')
    expect(call(0).headers.has('X-XSRF-TOKEN')).toBe(false)
  })

  it('relit le cookie XSRF-TOKEN à chaque requête mutante', async () => {
    fetchMock.mockImplementation(async () => new Response(null, { status: 204 }))

    document.cookie = 'XSRF-TOKEN=tok-1; path=/'
    await api('/api/auth/logout', { method: 'POST' })
    document.cookie = 'XSRF-TOKEN=tok-2; path=/'
    await api('/api/patterns/1', { method: 'DELETE' })

    expect(call(0).headers.get('X-XSRF-TOKEN')).toBe('tok-1')
    expect(call(1).headers.get('X-XSRF-TOKEN')).toBe('tok-2')
    expect(call(1).init.credentials).toBe('include')
  })

  it('décode la valeur du cookie', async () => {
    document.cookie = 'XSRF-TOKEN=a%3Db; path=/'
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await api('/api/auth/logout', { method: 'POST' })
    expect(call(0).headers.get('X-XSRF-TOKEN')).toBe('a=b')
  })

  it('envoie le corps en JSON, y compris sur un DELETE', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await api('/api/me', { method: 'DELETE', body: { password: 'x' } })
    expect(call(0).headers.get('Content-Type')).toBe('application/json')
    expect(call(0).init.body).toBe('{"password":"x"}')
  })

  it('renvoie undefined sur un 204', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(api('/api/auth/csrf')).resolves.toBeUndefined()
  })

  it('lève une ApiError avec les erreurs de champs', async () => {
    fetchMock.mockResolvedValueOnce(
      json(400, { status: 400, detail: 'Validation failed', errors: [{ field: 'title', message: 'must not be blank' }] }),
    )
    const error = await api('/api/patterns', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 400, fieldErrors: [{ field: 'title', message: 'must not be blank' }] })
  })

  it('lit Retry-After en secondes', async () => {
    fetchMock.mockResolvedValueOnce(json(429, { status: 429, detail: 'Too many attempts, try again later' }, { 'Retry-After': '120' }))
    const error = await api('/api/auth/login', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 429, retryAfter: 120 })
  })

  it('tolère un corps d’erreur non JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>boom</html>', { status: 500 }))
    const error = await api('/api/patterns').catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 500, problem: null, fieldErrors: [], retryAfter: null })
  })

  it('renvoie le statut 0 si le réseau échoue', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const error = await api('/api/me').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 0 })
  })

  it('après une 403, rafraîchit le CSRF et rejoue une seule fois', async () => {
    document.cookie = 'XSRF-TOKEN=old; path=/'
    fetchMock
      .mockResolvedValueOnce(json(403, { status: 403, detail: 'Access denied' }))
      .mockImplementationOnce(async () => {
        document.cookie = 'XSRF-TOKEN=fresh; path=/'
        return new Response(null, { status: 204 })
      })
      .mockResolvedValueOnce(json(201, { id: 7 }))

    await expect(api('/api/patterns', { method: 'POST', body: {} })).resolves.toEqual({ id: 7 })

    expect(call(1).url).toBe(`${API_URL}/api/auth/csrf`)
    expect(call(2).headers.get('X-XSRF-TOKEN')).toBe('fresh')
  })

  it('lève la 403 si le nouvel essai échoue aussi', async () => {
    fetchMock
      .mockResolvedValueOnce(json(403, { status: 403, detail: 'Access denied' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(403, { status: 403, detail: 'Access denied' }))

    const error = await api('/api/patterns', { method: 'POST', body: {} }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 403 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('ne rejoue pas une 403 qui ne vient pas du CSRF', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { status: 403, detail: 'Pattern 3 belongs to another account' }))
    const error = await api('/api/patterns/3', { method: 'PUT', body: {} }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 403, problem: { detail: 'Pattern 3 belongs to another account' } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejoue une 403 sans corps exploitable', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('', { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, { ok: true }))
    await expect(api('/api/patterns', { method: 'POST', body: {} })).resolves.toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('ne rejoue pas un GET en 403', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { status: 403, detail: 'Access denied' }))
    await api('/api/patterns').catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
