import { beforeEach, describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern, seedProgress } from '../test/db'
import { changePassword, fetchCsrf, getMe, login, logout, register } from './auth'
import { ApiError } from './client'
import {
  createPattern,
  deletePattern,
  deleteProgress,
  getPattern,
  listPatterns,
  listPublicPatterns,
  putProgress,
  updatePattern,
} from './patterns'

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

describe('visibilité et catalogue', () => {
  function twoAccounts() {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    const ana = seedAccount()
    return { ana, bob }
  }

  it('liste le catalogue public avec l’auteur, sans les patterns privés des autres', async () => {
    const { ana, bob } = twoAccounts()
    seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC' })
    seedPattern(bob.id, { title: 'Secret' })
    seedPattern(ana.id, { title: 'Abeille', visibility: 'PUBLIC' })

    const publics = await listPublicPatterns()

    expect(publics.map((p) => [p.title, p.author.username, p.mine])).toEqual([
      ['Abeille', 'ana', true],
      ['Ours', 'bob', false],
    ])
    expect((await listPatterns()).map((p) => p.title)).toEqual(['Abeille'])
  })

  it('garde un avancement par compte sur un pattern public', async () => {
    const { ana, bob } = twoAccounts()
    const ours = seedPattern(bob.id, { visibility: 'PUBLIC', progress: progressAt(1, 0) })

    await putProgress(ours.id, { status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 1 })

    expect((await getPattern(ours.id)).progress).toMatchObject({ stepIndex: 0, rowIndex: 1 })
    expect(db.patterns[0].progress).toMatchObject({ stepIndex: 1, rowIndex: 0 })
    expect(db.patterns[0].otherProgress[ana.id]).toMatchObject({ stepIndex: 0, rowIndex: 1 })
  })

  it('refuse en 403 l’écriture sur le pattern public d’un autre', async () => {
    const { bob } = twoAccounts()
    const ours = seedPattern(bob.id, { visibility: 'PUBLIC' })
    const update = await updatePattern(ours.id, { title: 'X', visibility: 'PUBLIC', steps: ours.steps }).catch((e: unknown) => e)
    const remove = await deletePattern(ours.id).catch((e: unknown) => e)
    expect(update).toMatchObject({ status: 403, problem: { detail: `Pattern ${ours.id} belongs to another account` } })
    expect(remove).toMatchObject({ status: 403 })
  })

  it('renvoie 404 sur le pattern privé d’un autre', async () => {
    const { bob } = twoAccounts()
    const secret = seedPattern(bob.id)
    await expect(getPattern(secret.id)).rejects.toMatchObject({ status: 404 })
  })

  it('repasser en privé coupe l’accès des autres et efface leur avancement', async () => {
    const { ana, bob } = twoAccounts()
    const ours = seedPattern(bob.id, { visibility: 'PUBLIC' })
    seedProgress(ours, ana.id, progressAt(0, 0))
    db.sessionAccountId = bob.id

    await updatePattern(ours.id, { title: ours.title, visibility: 'PRIVATE', steps: ours.steps })

    expect(db.patterns[0].otherProgress).toEqual({})
    db.sessionAccountId = ana.id
    await expect(getPattern(ours.id)).rejects.toMatchObject({ status: 404 })
  })

  it('un PUT sans visibilité repasse le pattern en privé (contrat serveur)', async () => {
    const { ana } = twoAccounts()
    const mine = seedPattern(ana.id, { visibility: 'PUBLIC' })
    const created = await createPattern({ title: 'Neuf', steps: mine.steps })
    expect(created.visibility).toBe('PRIVATE')
    expect((await updatePattern(mine.id, { title: mine.title, steps: mine.steps })).visibility).toBe('PRIVATE')
  })
})
