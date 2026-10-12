import { beforeEach, describe, expect, it } from 'vitest'
import { db, seedAccount, seedPattern } from '../test/db'
import { changePassword, fetchCsrf, getMe, login, logout, register } from './auth'
import { ApiError } from './client'
import { createPattern, deleteProgress, getPattern, listPatterns, putProgress, updatePattern } from './patterns'

beforeEach(async () => {
  await fetchCsrf()
})

describe('auth', () => {
  it('getMe renvoie null quand on n’est pas connecté', async () => {
    await expect(getMe()).resolves.toBeNull()
  })

  it('register connecte directement, et le token tourné sert à la requête suivante', async () => {
    const account = await register({ username: 'Ana', email: 'Ana@Example.com ', password: 'secret123' })
    expect(account).toMatchObject({ username: 'Ana', email: 'ana@example.com' })
    await expect(getMe()).resolves.toMatchObject({ email: 'ana@example.com' })
    await changePassword({ currentPassword: 'secret123', newPassword: 'secret456' })
    expect(db.accounts[0].password).toBe('secret456')
  })

  it('login échoue en 401 avec de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const error = await login({ username: 'ana', password: 'wrong' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
  })

  it('refuse un pseudo déjà pris, sans tenir compte de la casse', async () => {
    seedAccount({ loggedIn: false })
    const error = await register({ username: 'ANA', email: 'autre@example.com', password: 'secret123' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 409, fieldErrors: [{ field: 'username', message: 'is already used' }] })
  })

  it('logout ferme la session', async () => {
    seedAccount()
    await logout()
    await expect(getMe()).resolves.toBeNull()
  })
})

describe('patterns', () => {
  it('crée, liste et met à jour un pattern', async () => {
    seedAccount()
    const created = await createPattern({ title: 'Lapin', steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms' }] }] })
    expect(created).toMatchObject({ title: 'Lapin', hookSizeMm: null, progress: null })

    await expect(listPatterns()).resolves.toEqual([expect.objectContaining({ id: created.id, stepCount: 1 })])

    const updated = await updatePattern(created.id, { ...created, title: 'Lapin bleu' })
    expect(updated.title).toBe('Lapin bleu')
  })

  it('gère l’avancement et l’abandon', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id)

    await expect(putProgress(pattern.id, { status: 'IN_PROGRESS', stepIndex: 1, rowIndex: 0 })).resolves.toMatchObject({
      stepIndex: 1,
      rowIndex: 0,
    })
    const invalid = await putProgress(pattern.id, { status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 5 }).catch((e: unknown) => e)
    expect(invalid).toMatchObject({ status: 400, fieldErrors: [{ field: 'rowIndex', message: 'must be less than 2' }] })

    await deleteProgress(pattern.id)
    const again = await deleteProgress(pattern.id).catch((e: unknown) => e)
    expect(again).toMatchObject({ status: 404, problem: { detail: `Pattern ${pattern.id} is not started` } })
  })

  it('renvoie 404 pour le pattern d’un autre compte', async () => {
    const other = seedAccount({ email: 'bob@example.com', loggedIn: false })
    const pattern = seedPattern(other.id)
    seedAccount()
    await expect(getPattern(pattern.id)).rejects.toMatchObject({ status: 404 })
  })
})
