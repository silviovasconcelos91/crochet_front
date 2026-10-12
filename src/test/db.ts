import type { Account, Pattern, Progress, ProgressStatus } from '../api/types'

export interface DbAccount extends Account {
  password: string
}

/** `progress` est l'avancement de l'auteur ; celui des autres comptes est dans `otherProgress`. */
export interface DbPattern extends Omit<Pattern, 'author' | 'mine'> {
  ownerId: number
  otherProgress: Record<number, Progress>
}

interface Db {
  accounts: DbAccount[]
  patterns: DbPattern[]
  sessionAccountId: number | null
  csrfCounter: number
  nextId: number
}

export const db: Db = { accounts: [], patterns: [], sessionAccountId: null, csrfCounter: 0, nextId: 1 }

export function resetDb(): void {
  db.accounts = []
  db.patterns = []
  db.sessionAccountId = null
  db.csrfCounter = 0
  db.nextId = 1
}

export const SEED_DATE = '2026-10-12T12:00:00Z'

export function seedAccount({
  username = 'ana',
  email = 'ana@example.com',
  password = 'secret123',
  loggedIn = true,
}: { username?: string; email?: string; password?: string; loggedIn?: boolean } = {}): DbAccount {
  const account: DbAccount = { id: db.nextId++, username, email, password, createdAt: SEED_DATE }
  db.accounts.push(account)
  if (loggedIn) db.sessionAccountId = account.id
  return account
}

export function seedPattern(
  ownerId: number,
  overrides: Partial<Omit<DbPattern, 'id' | 'ownerId' | 'otherProgress'>> = {},
): DbPattern {
  const pattern: DbPattern = {
    id: db.nextId++,
    ownerId,
    otherProgress: {},
    title: 'Lapin',
    description: null,
    hookSizeMm: null,
    yarn: null,
    sourceUrl: null,
    imageUrl: null,
    visibility: 'PRIVATE',
    createdAt: SEED_DATE,
    updatedAt: SEED_DATE,
    steps: [
      { title: 'Tête', rows: [{ number: '1', value: '6ms dans cercle (6)' }, { number: '2', value: '6aug (12)' }] },
      { title: 'Corps', rows: [{ number: '1', value: '12ms (12)' }] },
    ],
    progress: null,
    ...overrides,
  }
  db.patterns.push(pattern)
  return pattern
}

/** Avancement d'un compte donné (l'auteur ou un autre) sur un pattern. */
export function seedProgress(pattern: DbPattern, accountId: number, progress: Progress): void {
  if (accountId === pattern.ownerId) pattern.progress = progress
  else pattern.otherProgress[accountId] = progress
}

export function progressAt(stepIndex: number, rowIndex: number, status: ProgressStatus = 'IN_PROGRESS'): Progress {
  return {
    status,
    stepIndex,
    rowIndex,
    startedAt: SEED_DATE,
    updatedAt: SEED_DATE,
    finishedAt: status === 'FINISHED' ? SEED_DATE : null,
  }
}
