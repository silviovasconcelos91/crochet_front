import type { Account, Pattern, Progress, ProgressStatus } from '../api/types'

export interface DbAccount extends Account {
  password: string
}

export interface DbPattern extends Pattern {
  ownerId: number
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

export function seedPattern(ownerId: number, overrides: Partial<Omit<DbPattern, 'id' | 'ownerId'>> = {}): DbPattern {
  const pattern: DbPattern = {
    id: db.nextId++,
    ownerId,
    title: 'Lapin',
    description: null,
    hookSizeMm: null,
    yarn: null,
    sourceUrl: null,
    imageUrl: null,
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
