# Front crochet — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** construire le front React complet (auth, liste, détail avec suivi d'avancement, formulaire de pattern, compte) pour l'API `crochet_back`.

**Architecture :**
- SPA Vite + React 19, routée par `createBrowserRouter` (react-router v7).
- L'état serveur passe par TanStack Query. Un client `fetch` unique gère la session cookie, le CSRF et les erreurs Problem Details.
- La logique métier pure (navigation dans les rangs, mapping des erreurs, numérotation) vit dans `src/lib/` et est testée unitairement. Les pages sont testées contre un faux backend MSW en mémoire.

**Tech Stack :** React 19, TypeScript 6, Vite 8, Tailwind CSS v4, react-router 7.18, @tanstack/react-query 5, react-hook-form 7, Vitest 5 + jsdom + Testing Library + MSW 2.

**Spec :** `docs/superpowers/specs/2026-10-12-crochet-front-design.md`. **Référence API :** `doc/front-api.md`. Les exécutants lisent les deux.

## Global Constraints

- Aucun endpoint ni champ en dehors de `doc/front-api.md`.
- Toutes les requêtes utilisent `credentials: 'include'`. Pour chaque `POST`/`PUT`/`DELETE`, le cookie `XSRF-TOKEN` est relu au moment de la requête et envoyé décodé dans `X-XSRF-TOKEN`.
- Toute l'UI est en français, au tutoiement. Les identifiants de code sont en anglais.
- Mobile-first : cibles tactiles d'au moins 44 px (`min-h-11` / `size-11`), champs de saisie en `text-base` (16 px, pas de zoom iOS).
- Dépendances autorisées :
  - runtime : `react-router@^7.18.4`, `@tanstack/react-query@^5`, `react-hook-form@^7` ;
  - dev : `tailwindcss@^4`, `@tailwindcss/vite@^4`, `vitest@^5`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `msw@^2`.
  - Ni axios, ni zod, ni bibliothèque de composants.
- Les positions sont indexées à partir de 0 côté API. À l'affichage : étape `stepIndex + 1`.
- `VITE_API_URL`, avec `http://localhost:8080` par défaut.
- Avant le merge, `npm run build`, `npm run lint` et `npm test` passent sans erreur.

## Review Focus

1. **URL `javascript:` dans `sourceUrl` ou `imageUrl`** : ne doit jamais être rendue comme lien ni comme image. Seules `http:` et `https:` sont acceptées. Test dans la Task 10.
2. **`?redirect=//evil.example` (ou `/\evil`) au login** : on doit revenir sur `/`, jamais sur un domaine externe. Tests dans les Tasks 7 et 8.
3. **Double appui rapide sur « Rang suivant »** : on avance de deux rangs, et le serveur termine sur la même position que l'UI. Test dans la Task 10.
4. **Session expirée (401) en enregistrant un formulaire modifié** : redirection vers le login, sans dialogue « Quitter sans enregistrer ». Test dans la Task 12.
5. **URL `/patterns/abc` ou `/patterns/0`** : écran « Pattern introuvable », sans aucun appel API. Test dans la Task 10.

---

## Structure des fichiers

```
src/
  main.tsx                         bootstrap (router + providers)
  index.css                        Tailwind + styles de base
  app/
    AppProviders.tsx               QueryClientProvider + ToastProvider
    routes.tsx                     arbre des routes (partagé app/tests)
    Root.tsx                       démarrage : csrf puis me
    RouteError.tsx                 errorElement
  api/
    types.ts                       types de la doc
    client.ts                      api(), ApiError, readXsrfToken, API_URL
    auth.ts                        endpoints auth/compte
    patterns.ts                    endpoints patterns/avancement
    queryClient.ts                 createQueryClient (401 global, retry)
    queries.ts                     clés + hooks TanStack
  auth/
    RequireAuth.tsx, GuestOnly.tsx
  components/
    Button, IconButton, Spinner, Skeleton, TextField, TextArea, FieldError,
    FormBanner, ConfirmDialog, ErrorState, StatusBadge, Layout, AuthShell,
    PatternNotFound
    toast/ToastProvider.tsx, toast/toastContext.ts, toast/useToast.ts
  hooks/
    useWakeLock.ts, useKeepAwakePreference.ts
  lib/
    progress.ts, rowNumber.ts, errors.ts, formErrors.ts, redirect.ts,
    validation.ts, format.ts, url.ts, patternId.ts
  pages/
    LoginPage, RegisterPage, PatternListPage, PatternDetailPage,
    PatternFormPage, AccountPage, NotFoundPage
    patternList/PatternCard.tsx
    patternDetail/PatternDetail.tsx, PatternInfo.tsx, StepList.tsx,
      ProgressActions.tsx, PatternMenu.tsx, useProgressActions.ts
    patternForm/formModel.ts, PatternForm.tsx, StepFields.tsx
    account/ChangePasswordForm.tsx, DeleteAccountForm.tsx
  test/
    setup.ts, server.ts, db.ts, handlers.ts, renderApp.tsx
```

Les tests sont placés à côté du code testé (`*.test.ts(x)`).

---

### Task 1 : Outillage (Tailwind, Vitest, MSW) et nettoyage du template

**Files :**
- Modify : `package.json`, `vite.config.ts`, `index.html`, `src/index.css`, `src/App.tsx`
- Create : `src/test/setup.ts`, `src/test/server.ts`, `src/App.test.tsx`, `.env.example`
- Delete : `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`, `src/assets/vite.svg`, `public/icons.svg`

**Interfaces :**
- Produces : `server` (MSW, `src/test/server.ts`), script `npm test`, classes Tailwind disponibles.

- [ ] **Step 1 : Créer la branche**

```bash
git checkout -b feat/front
```

- [ ] **Step 2 : Installer les dépendances**

```bash
npm install react-router@^7.18.4 @tanstack/react-query@^5 react-hook-form@^7
npm install -D tailwindcss@^4 @tailwindcss/vite@^4 vitest@^5 jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom msw@^2
```

- [ ] **Step 3 : Ajouter les scripts de test dans `package.json`**

Dans `"scripts"`, ajouter :

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4 : Configurer Vite et Vitest (`vite.config.ts`)**

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    unstubGlobals: true,
  },
})
```

- [ ] **Step 5 : Remplacer `src/index.css`**

```css
@import "tailwindcss";

html {
  -webkit-tap-highlight-color: transparent;
}

body {
  @apply bg-stone-50 text-stone-900 antialiased;
}
```

- [ ] **Step 6 : Mettre à jour `index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#be123c" />
    <title>Crochet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7 : Créer le serveur MSW vide (`src/test/server.ts`)**

```ts
import { setupServer } from 'msw/node'

export const server = setupServer()
```

- [ ] **Step 8 : Créer `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './server'

// jsdom n'implémente pas scrollIntoView
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}

function clearCookies() {
  for (const cookie of document.cookie.split('; ')) {
    const name = cookie.split('=')[0]
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  }
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  cleanup()
  clearCookies()
  localStorage.clear()
})
afterAll(() => server.close())
```

- [ ] **Step 9 : Écrire le test smoke (`src/App.test.tsx`)**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import App from './App'

it('affiche le titre de l’application', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Crochet' })).toBeInTheDocument()
})
```

- [ ] **Step 10 : Lancer le test et vérifier qu'il échoue**

Run : `npm test`
Expected : FAIL. Le template affiche « Get started », pas de titre « Crochet ».

- [ ] **Step 11 : Remplacer `src/App.tsx` et supprimer les fichiers du template**

```tsx
export default function App() {
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold text-rose-700">Crochet</h1>
    </main>
  )
}
```

```bash
git rm -q src/App.css src/assets/hero.png src/assets/react.svg src/assets/vite.svg public/icons.svg
```

- [ ] **Step 12 : Créer `.env.example`**

```
VITE_API_URL=http://localhost:8080
```

- [ ] **Step 13 : Vérifier**

Run : `npm test && npm run build && npm run lint`
Expected : test PASS, build OK, lint sans erreur.

- [ ] **Step 14 : Commit**

```bash
git add -A
git commit -m "chore: set up Tailwind v4, Vitest, MSW and clean Vite template"
```

---

### Task 2 : Types API et fonctions pures d'avancement et de numérotation

**Files :**
- Create : `src/api/types.ts`, `src/lib/progress.ts`, `src/lib/rowNumber.ts`
- Test : `src/lib/progress.test.ts`, `src/lib/rowNumber.test.ts`

**Interfaces :**
- Produces (`api/types.ts`) : `ProgressStatus`, `Account`, `Row`, `Step`, `Position`, `Progress`, `Pattern`, `PatternSummary`, `PatternInput`, `ProgressInput`, `ApiFieldError`, `Problem`.
- Produces (`lib/progress.ts`) :
  - `nextPosition(steps: Step[], pos: Position): Position | null`
  - `prevPosition(steps: Step[], pos: Position): Position | null`
  - `isFirstRow(steps, pos): boolean`, `isLastRow(steps, pos): boolean`
  - `type RowState = 'past' | 'current' | 'future'`
  - `compareToCurrent(stepIndex, rowIndex, progress: Progress | null): RowState`
  - `type PatternState = 'not-started' | 'in-progress' | 'finished'`
  - `patternState(progress: Progress | null): PatternState`
  - `optimisticProgress(previous: Progress | null, input: ProgressInput, now?: string): Progress`
- Produces (`lib/rowNumber.ts`) : `nextRowNumber(previous: string): string`

- [ ] **Step 1 : Créer `src/api/types.ts`**

```ts
export type ProgressStatus = 'IN_PROGRESS' | 'FINISHED'

export interface Account {
  id: number
  email: string
  createdAt: string
}

export interface Row {
  number: string
  value: string
}

export interface Step {
  title: string
  rows: Row[]
}

export interface Position {
  stepIndex: number
  rowIndex: number
}

export interface Progress extends Position {
  status: ProgressStatus
  startedAt: string
  updatedAt: string
  finishedAt: string | null
}

export interface Pattern {
  id: number
  title: string
  description: string | null
  hookSizeMm: number | null
  yarn: string | null
  sourceUrl: string | null
  imageUrl: string | null
  createdAt: string
  updatedAt: string
  steps: Step[]
  progress: Progress | null
}

export interface PatternSummary {
  id: number
  title: string
  description: string | null
  hookSizeMm: number | null
  yarn: string | null
  imageUrl: string | null
  stepCount: number
  progress: Progress | null
}

export interface PatternInput {
  title: string
  description?: string | null
  hookSizeMm?: number | null
  yarn?: string | null
  sourceUrl?: string | null
  imageUrl?: string | null
  steps: { title: string; rows: { number: string; value: string }[] }[]
}

export interface ProgressInput extends Position {
  status: ProgressStatus
}

export interface ApiFieldError {
  field: string
  message: string
}

export interface Problem {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  errors?: ApiFieldError[]
}
```

- [ ] **Step 2 : Écrire les tests de `progress.ts` (`src/lib/progress.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import type { Progress, Step } from '../api/types'
import {
  compareToCurrent,
  isFirstRow,
  isLastRow,
  nextPosition,
  optimisticProgress,
  patternState,
  prevPosition,
} from './progress'

const row = (n: string) => ({ number: n, value: `rang ${n}` })
const steps: Step[] = [
  { title: 'A', rows: [row('1'), row('2')] },
  { title: 'B', rows: [row('1')] },
  { title: 'C', rows: [row('1'), row('2'), row('3')] },
]

const progress = (stepIndex: number, rowIndex: number, status: Progress['status'] = 'IN_PROGRESS'): Progress => ({
  status,
  stepIndex,
  rowIndex,
  startedAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
  finishedAt: status === 'FINISHED' ? '2026-10-02T10:00:00Z' : null,
})

describe('nextPosition', () => {
  it('avance dans la même étape', () => {
    expect(nextPosition(steps, { stepIndex: 0, rowIndex: 0 })).toEqual({ stepIndex: 0, rowIndex: 1 })
  })
  it('passe au premier rang de l’étape suivante', () => {
    expect(nextPosition(steps, { stepIndex: 0, rowIndex: 1 })).toEqual({ stepIndex: 1, rowIndex: 0 })
  })
  it('traverse une étape à un seul rang', () => {
    expect(nextPosition(steps, { stepIndex: 1, rowIndex: 0 })).toEqual({ stepIndex: 2, rowIndex: 0 })
  })
  it('renvoie null au dernier rang de la dernière étape', () => {
    expect(nextPosition(steps, { stepIndex: 2, rowIndex: 2 })).toBeNull()
  })
})

describe('prevPosition', () => {
  it('recule dans la même étape', () => {
    expect(prevPosition(steps, { stepIndex: 2, rowIndex: 2 })).toEqual({ stepIndex: 2, rowIndex: 1 })
  })
  it('revient au dernier rang de l’étape précédente', () => {
    expect(prevPosition(steps, { stepIndex: 1, rowIndex: 0 })).toEqual({ stepIndex: 0, rowIndex: 1 })
  })
  it('renvoie null au tout premier rang', () => {
    expect(prevPosition(steps, { stepIndex: 0, rowIndex: 0 })).toBeNull()
  })
})

describe('isFirstRow / isLastRow', () => {
  it('détecte les bornes', () => {
    expect(isFirstRow(steps, { stepIndex: 0, rowIndex: 0 })).toBe(true)
    expect(isFirstRow(steps, { stepIndex: 1, rowIndex: 0 })).toBe(false)
    expect(isLastRow(steps, { stepIndex: 2, rowIndex: 2 })).toBe(true)
    expect(isLastRow(steps, { stepIndex: 1, rowIndex: 0 })).toBe(false)
  })
})

describe('compareToCurrent', () => {
  it('tout est futur si non commencé', () => {
    expect(compareToCurrent(0, 0, null)).toBe('future')
  })
  it('classe passé, courant et futur', () => {
    const p = progress(1, 0)
    expect(compareToCurrent(0, 1, p)).toBe('past')
    expect(compareToCurrent(1, 0, p)).toBe('current')
    expect(compareToCurrent(2, 0, p)).toBe('future')
  })
  it('compare les rangs dans l’étape courante', () => {
    const p = progress(2, 1)
    expect(compareToCurrent(2, 0, p)).toBe('past')
    expect(compareToCurrent(2, 2, p)).toBe('future')
  })
})

describe('patternState', () => {
  it('mappe le progress en état', () => {
    expect(patternState(null)).toBe('not-started')
    expect(patternState(progress(0, 0))).toBe('in-progress')
    expect(patternState(progress(0, 0, 'FINISHED'))).toBe('finished')
  })
})

describe('optimisticProgress', () => {
  const now = '2026-10-12T12:00:00Z'
  it('démarre un pattern', () => {
    expect(optimisticProgress(null, { status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0 }, now)).toEqual({
      status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0, startedAt: now, updatedAt: now, finishedAt: null,
    })
  })
  it('conserve startedAt et fixe finishedAt à la fin', () => {
    const result = optimisticProgress(progress(1, 0), { status: 'FINISHED', stepIndex: 1, rowIndex: 0 }, now)
    expect(result).toMatchObject({ startedAt: '2026-10-01T10:00:00Z', finishedAt: now, status: 'FINISHED' })
  })
  it('garde le finishedAt existant si on re-termine', () => {
    const result = optimisticProgress(progress(1, 0, 'FINISHED'), { status: 'FINISHED', stepIndex: 1, rowIndex: 0 }, now)
    expect(result.finishedAt).toBe('2026-10-02T10:00:00Z')
  })
  it('remet finishedAt à null quand on rouvre', () => {
    const result = optimisticProgress(progress(1, 0, 'FINISHED'), { status: 'IN_PROGRESS', stepIndex: 1, rowIndex: 0 }, now)
    expect(result.finishedAt).toBeNull()
  })
})
```

- [ ] **Step 3 : Écrire les tests de `rowNumber.ts` (`src/lib/rowNumber.test.ts`)**

```ts
import { expect, it } from 'vitest'
import { nextRowNumber } from './rowNumber'

it.each([
  ['2', '3'],
  ['3-5', '6'],
  ['10', '11'],
  [' 7 ', '8'],
  ['Rang 4', '5'],
  ['abc', ''],
  ['', ''],
])('nextRowNumber(%j) = %j', (previous, expected) => {
  expect(nextRowNumber(previous)).toBe(expected)
})
```

- [ ] **Step 4 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/lib`
Expected : FAIL avec « Failed to resolve import "./progress" » et « "./rowNumber" ».

- [ ] **Step 5 : Implémenter `src/lib/progress.ts`**

```ts
import type { Position, Progress, ProgressInput, Step } from '../api/types'

export function nextPosition(steps: Step[], pos: Position): Position | null {
  const step = steps[pos.stepIndex]
  if (!step) return null
  if (pos.rowIndex + 1 < step.rows.length) return { stepIndex: pos.stepIndex, rowIndex: pos.rowIndex + 1 }
  if (pos.stepIndex + 1 < steps.length) return { stepIndex: pos.stepIndex + 1, rowIndex: 0 }
  return null
}

export function prevPosition(steps: Step[], pos: Position): Position | null {
  if (pos.rowIndex > 0) return { stepIndex: pos.stepIndex, rowIndex: pos.rowIndex - 1 }
  const previous = steps[pos.stepIndex - 1]
  if (!previous) return null
  return { stepIndex: pos.stepIndex - 1, rowIndex: previous.rows.length - 1 }
}

export const isFirstRow = (steps: Step[], pos: Position): boolean => prevPosition(steps, pos) === null
export const isLastRow = (steps: Step[], pos: Position): boolean => nextPosition(steps, pos) === null

export type RowState = 'past' | 'current' | 'future'

export function compareToCurrent(stepIndex: number, rowIndex: number, progress: Progress | null): RowState {
  if (!progress) return 'future'
  if (stepIndex !== progress.stepIndex) return stepIndex < progress.stepIndex ? 'past' : 'future'
  if (rowIndex === progress.rowIndex) return 'current'
  return rowIndex < progress.rowIndex ? 'past' : 'future'
}

export type PatternState = 'not-started' | 'in-progress' | 'finished'

export function patternState(progress: Progress | null): PatternState {
  if (!progress) return 'not-started'
  return progress.status === 'FINISHED' ? 'finished' : 'in-progress'
}

export function optimisticProgress(
  previous: Progress | null,
  input: ProgressInput,
  now: string = new Date().toISOString(),
): Progress {
  return {
    status: input.status,
    stepIndex: input.stepIndex,
    rowIndex: input.rowIndex,
    startedAt: previous?.startedAt ?? now,
    updatedAt: now,
    finishedAt: input.status === 'FINISHED' ? (previous?.finishedAt ?? now) : null,
  }
}
```

- [ ] **Step 6 : Implémenter `src/lib/rowNumber.ts`**

```ts
/** Propose le libellé du rang suivant : "2" → "3", "3-5" → "6", texte sans nombre final → "". */
export function nextRowNumber(previous: string): string {
  const match = /(\d+)$/.exec(previous.trim())
  return match ? String(Number(match[1]) + 1) : ''
}
```

- [ ] **Step 7 : Lancer les tests et vérifier qu'ils passent**

Run : `npx vitest run src/lib`
Expected : PASS.

- [ ] **Step 8 : Commit**

```bash
git add src/api/types.ts src/lib
git commit -m "feat: add API types and pure progress/row-number helpers"
```

---

### Task 3 : Client HTTP (`api/client.ts`)

**Files :**
- Create : `src/api/client.ts`
- Test : `src/api/client.test.ts`

**Interfaces :**
- Consumes : `Problem`, `ApiFieldError` (Task 2).
- Produces :
  - `API_URL: string`
  - `class ApiError extends Error { status: number; problem: Problem | null; fieldErrors: ApiFieldError[]; retryAfter: number | null }`
  - `readXsrfToken(): string | undefined`
  - `interface ApiOptions { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown }`
  - `api<T>(path: string, options?: ApiOptions): Promise<T>`

- [ ] **Step 1 : Écrire les tests (`src/api/client.test.ts`)**

Ces tests remplacent `fetch` par un mock. MSW n'intervient pas ici.

```ts
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

  it('ne rejoue pas un GET en 403', async () => {
    fetchMock.mockResolvedValueOnce(json(403, { status: 403, detail: 'Access denied' }))
    await api('/api/patterns').catch(() => undefined)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/api/client.test.ts`
Expected : FAIL avec « Failed to resolve import "./client" ».

- [ ] **Step 3 : Implémenter `src/api/client.ts`**

```ts
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
  if (response.status === 403 && options.method !== undefined && options.method !== 'GET') {
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
```

- [ ] **Step 4 : Lancer les tests et vérifier qu'ils passent**

Run : `npx vitest run src/api/client.test.ts`
Expected : PASS (12 tests).

- [ ] **Step 5 : Commit**

```bash
git add src/api/client.ts src/api/client.test.ts
git commit -m "feat: add fetch client with CSRF handling and ApiError"
```

---

### Task 4 : Messages d'erreur et mapping des erreurs de formulaire

**Files :**
- Create : `src/lib/errors.ts`, `src/lib/formErrors.ts`
- Test : `src/lib/errors.test.ts`, `src/lib/formErrors.test.ts`

**Interfaces :**
- Consumes : `ApiError` (Task 3), `ApiFieldError` (Task 2).
- Produces (`lib/errors.ts`) :
  - `errorMessage(error: unknown): string`
  - `retryMessage(retryAfter: number | null): string`
  - `translateServerMessage(message: string): string`
  - `isNotFound(error: unknown): boolean`
  - `isNotStarted(error: unknown): boolean`
- Produces (`lib/formErrors.ts`) :
  - `toFormPath(serverPath: string): string`
  - `splitFieldErrors(errors: ApiFieldError[], values: unknown): { fields: { path: string; message: string }[]; others: ApiFieldError[] }`
  - `firstErrorPath(errors: unknown): string | null`
  - `scheduleFocusFirstError(form)`
  - `applyServerErrors<T extends FieldValues>(error: unknown, form: ServerErrorForm<T>): string | null`. Pose les erreurs sur les champs et renvoie le message du bandeau (ou `null`).

- [ ] **Step 1 : Écrire les tests de `errors.ts` (`src/lib/errors.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { errorMessage, isNotFound, isNotStarted, retryMessage, translateServerMessage } from './errors'

const apiError = (status: number, detail?: string, retryAfter: number | null = null) =>
  new ApiError(status, detail ? { status, detail } : null, retryAfter)

describe('errorMessage', () => {
  it.each([
    [apiError(0), 'Serveur injoignable, vérifie ta connexion'],
    [apiError(400, 'Bad Request'), 'Requête invalide'],
    [apiError(401, 'Invalid email or password'), 'Email ou mot de passe incorrect'],
    [apiError(401, 'Authentication required'), 'Session expirée, reconnecte-toi'],
    [apiError(403, 'Access denied'), 'Session invalide, recharge la page'],
    [apiError(404, 'Pattern 12 not found'), 'Ce pattern est introuvable'],
    [apiError(409, 'Email already used'), 'Cet email est déjà utilisé'],
    [apiError(500, 'Internal error'), 'Erreur inattendue, réessaie plus tard'],
    [apiError(502), 'Erreur inattendue, réessaie plus tard'],
    [new Error('boom'), 'Erreur inattendue, réessaie plus tard'],
  ])('%#', (error, expected) => {
    expect(errorMessage(error)).toBe(expected)
  })

  it('formate la 429 avec Retry-After', () => {
    expect(errorMessage(apiError(429, 'Too many attempts, try again later', 600))).toBe(
      'Trop de tentatives, réessaie dans 10 min',
    )
  })
})

describe('retryMessage', () => {
  it.each([
    [null, 'Trop de tentatives, réessaie plus tard'],
    [45, 'Trop de tentatives, réessaie dans 45 s'],
    [60, 'Trop de tentatives, réessaie dans 1 min'],
    [61, 'Trop de tentatives, réessaie dans 2 min'],
    [900, 'Trop de tentatives, réessaie dans 15 min'],
  ])('retryMessage(%j)', (seconds, expected) => {
    expect(retryMessage(seconds)).toBe(expected)
  })
})

describe('translateServerMessage', () => {
  it.each([
    ['must not be blank', 'Obligatoire'],
    ['must not be empty', 'Ne doit pas être vide'],
    ['is incorrect', 'Mot de passe incorrect'],
    ['must be a well-formed email address', 'Email invalide'],
    ['size must be between 8 and 72', 'Entre 8 et 72 caractères'],
    ['must be less than 3', 'Doit être inférieur à 3'],
    ['something else', 'something else'],
  ])('%s', (message, expected) => {
    expect(translateServerMessage(message)).toBe(expected)
  })
})

describe('isNotFound / isNotStarted', () => {
  it('distingue les deux 404', () => {
    expect(isNotFound(apiError(404, 'Pattern 12 not found'))).toBe(true)
    expect(isNotStarted(apiError(404, 'Pattern 12 is not started'))).toBe(true)
    expect(isNotStarted(apiError(404, 'Pattern 12 not found'))).toBe(false)
    expect(isNotFound(apiError(500))).toBe(false)
  })
})
```

- [ ] **Step 2 : Écrire les tests de `formErrors.ts` (`src/lib/formErrors.test.ts`)**

```ts
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { applyServerErrors, firstErrorPath, splitFieldErrors, toFormPath } from './formErrors'

describe('toFormPath', () => {
  it.each([
    ['title', 'title'],
    ['steps[0].title', 'steps.0.title'],
    ['steps[0].rows[1].value', 'steps.0.rows.1.value'],
  ])('%s → %s', (input, expected) => {
    expect(toFormPath(input)).toBe(expected)
  })
})

describe('splitFieldErrors', () => {
  const values = { title: '', steps: [{ title: 'A', rows: [{ number: '1', value: '' }] }] }

  it('sépare les champs connus des autres', () => {
    const result = splitFieldErrors(
      [
        { field: 'title', message: 'must not be blank' },
        { field: 'steps[0].rows[0].value', message: 'must not be blank' },
        { field: 'steps', message: 'must not be empty' },
        { field: 'unknown', message: 'nope' },
      ],
      values,
    )
    expect(result.fields).toEqual([
      { path: 'title', message: 'must not be blank' },
      { path: 'steps.0.rows.0.value', message: 'must not be blank' },
    ])
    expect(result.others).toEqual([
      { field: 'steps', message: 'must not be empty' },
      { field: 'unknown', message: 'nope' },
    ])
  })
})

describe('firstErrorPath', () => {
  it('trouve le premier champ en erreur, même imbriqué', () => {
    const errors = {
      steps: [undefined, { rows: [undefined, { value: { type: 'validate', message: 'Obligatoire' } }] }],
    }
    expect(firstErrorPath(errors)).toBe('steps.1.rows.1.value')
  })
  it('renvoie null sans erreur', () => {
    expect(firstErrorPath({})).toBeNull()
  })
})

describe('applyServerErrors', () => {
  const makeForm = (values: Record<string, unknown>) => ({
    setError: vi.fn(),
    setFocus: vi.fn(),
    getValues: () => values,
    formState: { errors: {} },
  })

  it('pose les erreurs traduites sur les champs et renvoie les autres pour le bandeau', () => {
    const form = makeForm({ password: '' })
    const error = new ApiError(400, {
      status: 400,
      detail: 'Validation failed',
      errors: [
        { field: 'password', message: 'is incorrect' },
        { field: 'other', message: 'must not be empty' },
      ],
    }, null)

    const banner = applyServerErrors(error, form as never)

    expect(form.setError).toHaveBeenCalledWith('password', { type: 'server', message: 'Mot de passe incorrect' })
    expect(banner).toBe('Ne doit pas être vide')
  })

  it('renvoie null quand toutes les erreurs ont un champ', () => {
    const form = makeForm({ title: '' })
    const error = new ApiError(400, { errors: [{ field: 'title', message: 'must not be blank' }] }, null)
    expect(applyServerErrors(error, form as never)).toBeNull()
  })

  it('renvoie le message générique sans erreurs de champs', () => {
    const form = makeForm({})
    expect(applyServerErrors(new ApiError(429, null, 30), form as never)).toBe('Trop de tentatives, réessaie dans 30 s')
    expect(applyServerErrors(new Error('x'), form as never)).toBe('Erreur inattendue, réessaie plus tard')
  })
})
```

> Note : `as never` est voulu, car le formulaire factice ne reproduit pas tous les types de react-hook-form.

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/lib/errors.test.ts src/lib/formErrors.test.ts`
Expected : FAIL, imports introuvables.

- [ ] **Step 4 : Implémenter `src/lib/errors.ts`**

```ts
import { ApiError } from '../api/client'

const GENERIC = 'Erreur inattendue, réessaie plus tard'

export function retryMessage(retryAfter: number | null): string {
  if (retryAfter === null) return 'Trop de tentatives, réessaie plus tard'
  if (retryAfter < 60) return `Trop de tentatives, réessaie dans ${retryAfter} s`
  return `Trop de tentatives, réessaie dans ${Math.ceil(retryAfter / 60)} min`
}

export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return GENERIC
  switch (error.status) {
    case 0:
      return 'Serveur injoignable, vérifie ta connexion'
    case 400:
      return 'Requête invalide'
    case 401:
      return error.problem?.detail === 'Invalid email or password'
        ? 'Email ou mot de passe incorrect'
        : 'Session expirée, reconnecte-toi'
    case 403:
      return 'Session invalide, recharge la page'
    case 404:
      return 'Ce pattern est introuvable'
    case 409:
      return 'Cet email est déjà utilisé'
    case 429:
      return retryMessage(error.retryAfter)
    default:
      return GENERIC
  }
}

const TRANSLATIONS: [RegExp, string][] = [
  [/^must not be blank$/, 'Obligatoire'],
  [/^must not be empty$/, 'Ne doit pas être vide'],
  [/^is incorrect$/, 'Mot de passe incorrect'],
  [/^must be a well-formed email address$/, 'Email invalide'],
  [/^size must be between (\d+) and (\d+)$/, 'Entre $1 et $2 caractères'],
  [/^must be less than (\d+)$/, 'Doit être inférieur à $1'],
]

export function translateServerMessage(message: string): string {
  for (const [pattern, replacement] of TRANSLATIONS) {
    if (pattern.test(message)) return message.replace(pattern, replacement)
  }
  return message
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

export function isNotStarted(error: unknown): boolean {
  return isNotFound(error) && (error as ApiError).problem?.detail?.endsWith('is not started') === true
}
```

- [ ] **Step 5 : Implémenter `src/lib/formErrors.ts`**

```ts
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form'
import { ApiError } from '../api/client'
import type { ApiFieldError } from '../api/types'
import { errorMessage, translateServerMessage } from './errors'

/** "steps[0].rows[1].value" (Spring) → "steps.0.rows.1.value" (react-hook-form). */
export function toFormPath(serverPath: string): string {
  return serverPath.replace(/\[(\d+)\]/g, '.$1')
}

function valueAt(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current === null || typeof current !== 'object') return undefined
    return (current as Record<string, unknown>)[key]
  }, source)
}

/** Un champ « connu » est une feuille du formulaire (texte/nombre/null), pas un tableau ni un objet. */
export function splitFieldErrors(errors: ApiFieldError[], values: unknown) {
  const fields: { path: string; message: string }[] = []
  const others: ApiFieldError[] = []
  for (const error of errors) {
    const path = toFormPath(error.field)
    const value = valueAt(values, path)
    if (value !== undefined && (value === null || typeof value !== 'object')) fields.push({ path, message: error.message })
    else others.push(error)
  }
  return { fields, others }
}

export function firstErrorPath(errors: unknown, prefix = ''): string | null {
  if (errors === null || typeof errors !== 'object') return null
  if ('type' in errors && typeof (errors as { type: unknown }).type === 'string') return prefix || null
  for (const [key, value] of Object.entries(errors)) {
    if (key === 'ref') continue
    const found = firstErrorPath(value, prefix ? `${prefix}.${key}` : key)
    if (found) return found
  }
  return null
}

type FocusableForm<T extends FieldValues> = Pick<UseFormReturn<T>, 'formState' | 'setFocus'>
export type ServerErrorForm<T extends FieldValues> = FocusableForm<T> & Pick<UseFormReturn<T>, 'setError' | 'getValues'>

/** Après rendu (étapes repliées dépliées), focus et défilement sur le premier champ en erreur. */
export function scheduleFocusFirstError<T extends FieldValues>(form: FocusableForm<T>): void {
  setTimeout(() => {
    const path = firstErrorPath(form.formState.errors)
    if (path) form.setFocus(path as Path<T>)
  }, 0)
}

export function applyServerErrors<T extends FieldValues>(error: unknown, form: ServerErrorForm<T>): string | null {
  if (!(error instanceof ApiError) || error.fieldErrors.length === 0) return errorMessage(error)
  const { fields, others } = splitFieldErrors(error.fieldErrors, form.getValues())
  for (const field of fields) {
    form.setError(field.path as Path<T>, { type: 'server', message: translateServerMessage(field.message) })
  }
  if (fields.length > 0) scheduleFocusFirstError(form)
  return others.length > 0 ? others.map((other) => translateServerMessage(other.message)).join(' · ') : null
}
```

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils passent**

Run : `npx vitest run src/lib && npx tsc -b`
Expected : PASS, aucune erreur TS.

- [ ] **Step 7 : Commit**

```bash
git add src/lib
git commit -m "feat: add French error messages and server field error mapping"
```

---

### Task 5 : Endpoints API et faux backend de test

**Files :**
- Create : `src/api/auth.ts`, `src/api/patterns.ts`, `src/test/db.ts`, `src/test/handlers.ts`
- Modify : `src/test/server.ts`, `src/test/setup.ts`
- Test : `src/api/endpoints.test.ts`

**Interfaces :**
- Consumes : `api`, `ApiError`, `API_URL` (Task 3), types (Task 2).
- Produces (`api/auth.ts`) :
  - `fetchCsrf(): Promise<void>`
  - `getMe(): Promise<Account | null>` (un 401 donne `null`)
  - `interface Credentials { email: string; password: string }`
  - `register(c: Credentials): Promise<Account>`, `login(c: Credentials): Promise<Account>`, `logout(): Promise<void>`
  - `changePassword(body: { currentPassword: string; newPassword: string }): Promise<void>`
  - `deleteAccount(password: string): Promise<void>`
- Produces (`api/patterns.ts`) :
  - `listPatterns()`, `getPattern(id)`, `createPattern(input)`, `updatePattern(id, input)`, `deletePattern(id)`
  - `putProgress(id, input: ProgressInput): Promise<Progress>`, `deleteProgress(id): Promise<void>`
- Produces (tests) :
  - `db`, `resetDb()`, `seedAccount(opts?)`, `seedPattern(ownerId, overrides?)`, `progressAt(stepIndex, rowIndex, status?)`, types `DbAccount`, `DbPattern`
  - `apiUrl(path)`, `problem(status, detail, init?)`, `handlers`

- [ ] **Step 1 : Créer `src/api/auth.ts`**

```ts
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
```

- [ ] **Step 2 : Créer `src/api/patterns.ts`**

```ts
import { api } from './client'
import type { Pattern, PatternInput, PatternSummary, Progress, ProgressInput } from './types'

export const listPatterns = () => api<PatternSummary[]>('/api/patterns')

export const getPattern = (id: number) => api<Pattern>(`/api/patterns/${id}`)

export const createPattern = (input: PatternInput) => api<Pattern>('/api/patterns', { method: 'POST', body: input })

export const updatePattern = (id: number, input: PatternInput) =>
  api<Pattern>(`/api/patterns/${id}`, { method: 'PUT', body: input })

export const deletePattern = (id: number) => api<void>(`/api/patterns/${id}`, { method: 'DELETE' })

export const putProgress = (id: number, input: ProgressInput) =>
  api<Progress>(`/api/patterns/${id}/progress`, { method: 'PUT', body: input })

export const deleteProgress = (id: number) => api<void>(`/api/patterns/${id}/progress`, { method: 'DELETE' })
```

- [ ] **Step 3 : Créer la base en mémoire du faux backend (`src/test/db.ts`)**

```ts
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
  email = 'ana@example.com',
  password = 'secret123',
  loggedIn = true,
}: { email?: string; password?: string; loggedIn?: boolean } = {}): DbAccount {
  const account: DbAccount = { id: db.nextId++, email, password, createdAt: SEED_DATE }
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
```

- [ ] **Step 4 : Créer les handlers MSW (`src/test/handlers.ts`)**

Ils imitent `doc/front-api.md` : CSRF vérifié sur les mutations, session en mémoire, 401, 404 et validation.

```ts
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
```

- [ ] **Step 5 : Brancher les handlers (`src/test/server.ts`)**

```ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

- [ ] **Step 6 : Réinitialiser la base entre les tests (`src/test/setup.ts`)**

Ajouter l'import et l'appel :

```ts
import { resetDb } from './db'
```

et, dans `afterEach`, juste après `cleanup()` :

```ts
  resetDb()
```

- [ ] **Step 7 : Écrire les tests des endpoints contre le faux backend (`src/api/endpoints.test.ts`)**

```ts
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
    const account = await register({ email: 'Ana@Example.com ', password: 'secret123' })
    expect(account.email).toBe('ana@example.com')
    await expect(getMe()).resolves.toMatchObject({ email: 'ana@example.com' })
    await changePassword({ currentPassword: 'secret123', newPassword: 'secret456' })
    expect(db.accounts[0].password).toBe('secret456')
  })

  it('login échoue en 401 avec de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const error = await login({ email: 'ana@example.com', password: 'wrong' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 401 })
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
```

- [ ] **Step 8 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b`
Expected : PASS. Si une erreur de type apparaît sur `PathParams` dans `authed`, typer `params` en `Record<string, string | readonly string[] | undefined>`.

- [ ] **Step 9 : Commit**

```bash
git add src/api src/test
git commit -m "feat: add API endpoint functions and in-memory MSW backend for tests"
```

---

### Task 6 : Composants UI de base et toasts

**Files :**
- Create :
  - `src/components/Spinner.tsx`, `Button.tsx`, `IconButton.tsx`, `Skeleton.tsx` ;
  - `FieldError.tsx`, `TextField.tsx`, `TextArea.tsx`, `FormBanner.tsx` ;
  - `ConfirmDialog.tsx`, `ErrorState.tsx` ;
  - `src/components/toast/toastContext.ts`, `toast/useToast.ts`, `toast/ToastProvider.tsx`.
- Test : `src/components/components.test.tsx`

**Interfaces :**
- Consumes : `errorMessage` (Task 4).
- Produces :
  - `Spinner({ className? })`, `FullPageSpinner()`
  - `Button({ variant?: 'primary' | 'secondary' | 'danger' | 'ghost', loading?, ...button })`
  - `IconButton({ label, ...button })`
  - `Skeleton({ className? })`
  - `FieldError({ id?, message? })`
  - `TextField({ label, error?, hint?, hideLabel?, ref?, ...input })`, `TextArea({ label, error?, hideLabel?, ref?, ...textarea })`
  - `FormBanner({ message?: string | null, tone?: 'error' | 'info' | 'success' })`
  - `ConfirmDialog({ open, title, message, confirmLabel, danger?, loading?, onConfirm, onCancel })`
  - `ErrorState({ error, onRetry })`
  - `ToastProvider({ children })`, `useToast(): { show(message: string, tone?: 'error' | 'success' | 'info'): void }`

- [ ] **Step 1 : Écrire les tests (`src/components/components.test.tsx`)**

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import { TextField } from './TextField'
import { ToastProvider } from './toast/ToastProvider'
import { useToast } from './toast/useToast'

describe('TextField', () => {
  it('relie le message d’erreur au champ', () => {
    render(<TextField label="Email" error="Obligatoire" />)
    const input = screen.getByLabelText('Email')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Obligatoire')
  })
})

describe('ConfirmDialog', () => {
  it('confirme, annule et se ferme avec Échap', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmDialog open title="Supprimer ?" message="Action définitive." confirmLabel="Supprimer" danger onConfirm={onConfirm} onCancel={onCancel} />,
    )
    expect(screen.getByRole('alertdialog', { name: 'Supprimer ?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it('ne rend rien quand il est fermé', () => {
    render(<ConfirmDialog open={false} title="T" message="M" confirmLabel="OK" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('Toast', () => {
  function Trigger() {
    const toast = useToast()
    return <button onClick={() => toast.show('Pattern supprimé', 'success')}>go</button>
  }

  it('affiche un toast puis le retire après 4 s', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByText('go'))
    expect(screen.getByRole('status')).toHaveTextContent('Pattern supprimé')
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Pattern supprimé')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/components`
Expected : FAIL, imports introuvables.

- [ ] **Step 3 : `src/components/Spinner.tsx`**

```tsx
export function Spinner({ className = 'size-6' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Chargement"
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center text-rose-600">
      <Spinner className="size-10" />
    </div>
  )
}
```

- [ ] **Step 4 : `src/components/Button.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  secondary: 'bg-white text-stone-800 ring-1 ring-stone-300 hover:bg-stone-100 disabled:text-stone-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  ghost: 'text-rose-700 hover:bg-rose-50 disabled:text-stone-400',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  )
}
```

- [ ] **Step 5 : `src/components/IconButton.tsx`**

```tsx
import type { ButtonHTMLAttributes } from 'react'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
}

export function IconButton({ label, className = '', children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-xl text-lg text-stone-600 hover:bg-stone-100 disabled:opacity-30 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
```

- [ ] **Step 6 : `src/components/Skeleton.tsx` et `src/components/FieldError.tsx`**

```tsx
export function Skeleton({ className = 'h-20' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-2xl bg-stone-200 ${className}`} />
}
```

```tsx
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-red-600">
      {message}
    </p>
  )
}
```

- [ ] **Step 7 : `src/components/TextField.tsx`**

```tsx
import { useId, type InputHTMLAttributes, type Ref } from 'react'
import { FieldError } from './FieldError'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
  hideLabel?: boolean
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, error, hint, hideLabel = false, id, className = '', ...rest }: TextFieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const hintId = `${inputId}-hint`
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-stone-700'}>
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none aria-invalid:border-red-500"
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-stone-500">
          {hint}
        </p>
      )}
      <FieldError id={errorId} message={error} />
    </div>
  )
}
```

- [ ] **Step 8 : `src/components/TextArea.tsx`**

```tsx
import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import { FieldError } from './FieldError'

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hideLabel?: boolean
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ label, error, hideLabel = false, id, className = '', ...rest }: TextAreaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={inputId} className={hideLabel ? 'sr-only' : 'text-sm font-medium text-stone-700'}>
        {label}
      </label>
      <textarea
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className="field-sizing-content min-h-11 w-full resize-none rounded-xl border border-stone-300 bg-white px-3 py-2 text-base focus:border-rose-500 focus:ring-2 focus:ring-rose-200 focus:outline-none aria-invalid:border-red-500"
        {...rest}
      />
      <FieldError id={errorId} message={error} />
    </div>
  )
}
```

- [ ] **Step 9 : `src/components/FormBanner.tsx`**

```tsx
const TONES = {
  error: 'bg-red-50 text-red-800 ring-red-200',
  info: 'bg-sky-50 text-sky-900 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-900 ring-emerald-200',
}

export function FormBanner({ message, tone = 'error' }: { message?: string | null; tone?: keyof typeof TONES }) {
  if (!message) return null
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl px-4 py-3 text-sm ring-1 ${TONES[tone]}`}>
      {message}
    </div>
  )
}
```

- [ ] **Step 10 : `src/components/ConfirmDialog.tsx`**

```tsx
import { useEffect, useId } from 'react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger = false, loading = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useId()
  const messageId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p id={messageId} className="mt-2 text-stone-600">
          {message}
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} className="flex-1" loading={loading} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 11 : `src/components/ErrorState.tsx`**

```tsx
import { errorMessage } from '../lib/errors'
import { Button } from './Button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p role="alert" className="text-stone-700">
        {errorMessage(error)}
      </p>
      <Button variant="secondary" onClick={onRetry}>
        Réessayer
      </Button>
    </div>
  )
}
```

- [ ] **Step 12 : Toasts (contexte, hook et provider dans trois fichiers, pour respecter `react/only-export-components`)**

`src/components/toast/toastContext.ts` :

```ts
import { createContext } from 'react'

export type ToastTone = 'error' | 'success' | 'info'

export interface ToastApi {
  show: (message: string, tone?: ToastTone) => void
}

export const ToastContext = createContext<ToastApi | null>(null)
```

`src/components/toast/useToast.ts` :

```ts
import { useContext } from 'react'
import { ToastContext, type ToastApi } from './toastContext'

export function useToast(): ToastApi {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside <ToastProvider>')
  return context
}
```

`src/components/toast/ToastProvider.tsx` :

```tsx
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastTone } from './toastContext'

interface ToastItem {
  id: number
  message: string
  tone: ToastTone
}

const TONES: Record<ToastTone, string> = {
  error: 'bg-red-700 text-white',
  success: 'bg-emerald-700 text-white',
  info: 'bg-stone-800 text-white',
}

const DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((item) => item.id !== id)), [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++
      setItems((list) => [...list, { id, message, tone }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto w-full max-w-sm rounded-xl px-4 py-3 text-sm shadow-lg ${TONES[item.tone]}`}
            onClick={() => dismiss(item.id)}
          >
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext>
  )
}
```

- [ ] **Step 13 : Lancer les tests et vérifier qu'ils passent**

Run : `npx vitest run src/components && npx tsc -b && npm run lint`
Expected : PASS, aucune erreur.

- [ ] **Step 14 : Commit**

```bash
git add src/components
git commit -m "feat: add base UI components and toast system"
```

---

### Task 7 : Coquille de l'app (query client, démarrage, routes, garde d'auth, layout)

**Files :**
- Create :
  - `src/api/queryClient.ts`, `src/api/queries.ts` ;
  - `src/lib/redirect.ts`, `src/auth/RequireAuth.tsx`, `src/auth/GuestOnly.tsx` ;
  - `src/components/Layout.tsx` ;
  - `src/app/AppProviders.tsx`, `src/app/Root.tsx`, `src/app/RouteError.tsx`, `src/app/routes.tsx` ;
  - `src/pages/NotFoundPage.tsx` ;
  - placeholders remplacés plus tard : `src/pages/LoginPage.tsx`, `RegisterPage.tsx`, `PatternListPage.tsx`, `PatternDetailPage.tsx`, `PatternFormPage.tsx`, `AccountPage.tsx` ;
  - `src/test/renderApp.tsx`.
- Modify : `src/main.tsx`
- Delete : `src/App.tsx`, `src/App.test.tsx`
- Test : `src/lib/redirect.test.ts`, `src/app/app.test.tsx`

**Interfaces :**
- Consumes : `fetchCsrf`, `getMe` (Task 5), `ApiError` (Task 3), `ErrorState`, `FullPageSpinner`, `ToastProvider` (Task 6).
- Produces :
  - `createQueryClient(): QueryClient`, `shouldRetry(failureCount, error): boolean`
  - `queryKeys = { csrf, me, patterns, pattern(id) }`
  - `useCsrf()`, `useMe(enabled?: boolean)`
  - `safeRedirect(value: string | null): string`
  - `routes: RouteObject[]`, `AppProviders({ queryClient, children })`
  - `renderApp(path: string): { user, router, queryClient, ...RenderResult }`
  - Les mutations peuvent passer `meta: { skipAuthRedirect: true }` pour ignorer la redirection globale sur 401 (utilisé par le login).

- [ ] **Step 1 : Écrire les tests de `redirect.ts` (`src/lib/redirect.test.ts`)**

```ts
import { expect, it } from 'vitest'
import { safeRedirect } from './redirect'

it.each([
  [null, '/'],
  ['', '/'],
  ['/account', '/account'],
  ['/patterns/3?x=1', '/patterns/3?x=1'],
  ['//evil.example', '/'],
  ['/\\evil.example', '/'],
  ['https://evil.example', '/'],
  ['account', '/'],
])('safeRedirect(%j) = %j', (value, expected) => {
  expect(safeRedirect(value)).toBe(expected)
})
```

- [ ] **Step 2 : Implémenter `src/lib/redirect.ts`**

```ts
/** N'accepte que des chemins internes : refuse "//host", "/\host" et les URL absolues. */
export function safeRedirect(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
```

Run : `npx vitest run src/lib/redirect.test.ts`. Expected : PASS.

- [ ] **Step 3 : `src/api/queries.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { fetchCsrf, getMe } from './auth'

export const queryKeys = {
  csrf: ['csrf'] as const,
  me: ['me'] as const,
  patterns: ['patterns'] as const,
  pattern: (id: number) => ['patterns', id] as const,
}

export function useCsrf() {
  return useQuery({
    queryKey: queryKeys.csrf,
    queryFn: async () => {
      await fetchCsrf()
      return true
    },
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

export function useMe(enabled = true) {
  return useQuery({ queryKey: queryKeys.me, queryFn: getMe, staleTime: Infinity, enabled })
}
```

- [ ] **Step 4 : `src/api/queryClient.ts`**

```ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'
import { queryKeys } from './queries'

export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && error instanceof ApiError && (error.status === 0 || error.status >= 500)
}

export function createQueryClient(): QueryClient {
  // Tout 401 hors login : la session est perdue, RequireAuth redirige vers /login.
  const handleUnauthorized = (error: unknown) => {
    if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(queryKeys.me, null)
  }

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.queryKey[0] !== queryKeys.me[0]) handleUnauthorized(error)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.skipAuthRedirect) handleUnauthorized(error)
      },
    }),
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
  return queryClient
}
```

- [ ] **Step 5 : Gardes d'auth**

`src/auth/RequireAuth.tsx` :

```tsx
import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../api/queries'

export function RequireAuth() {
  const { data: me } = useMe()
  const location = useLocation()
  if (!me) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }
  return <Outlet />
}
```

`src/auth/GuestOnly.tsx` :

```tsx
import { Navigate, Outlet, useSearchParams } from 'react-router'
import { useMe } from '../api/queries'
import { safeRedirect } from '../lib/redirect'

/** Login/inscription : dès que `me` existe (après succès), on part vers `redirect`. */
export function GuestOnly() {
  const { data: me } = useMe()
  const [params] = useSearchParams()
  if (me) return <Navigate to={safeRedirect(params.get('redirect'))} replace />
  return <Outlet />
}
```

- [ ] **Step 6 : `src/components/Layout.tsx`**

```tsx
import { Link, NavLink, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold text-rose-700">
            🧶 Crochet
          </Link>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `grid min-h-11 place-items-center rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-rose-50 text-rose-700' : 'text-stone-700'}`
            }
          >
            Compte
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 7 : Démarrage, erreur de route et 404**

`src/app/Root.tsx` :

```tsx
import { Outlet } from 'react-router'
import { useCsrf, useMe } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { FullPageSpinner } from '../components/Spinner'

/** Pose le cookie XSRF puis lit la session avant d'afficher quoi que ce soit. */
export function Root() {
  const csrf = useCsrf()
  const me = useMe(csrf.isSuccess)

  if (csrf.isError || me.isError) {
    return (
      <main className="mx-auto max-w-sm px-4 pt-20">
        <ErrorState
          error={csrf.error ?? me.error}
          onRetry={() => {
            if (csrf.isError) void csrf.refetch()
            if (me.isError) void me.refetch()
          }}
        />
      </main>
    )
  }
  if (!csrf.isSuccess || me.isPending) return <FullPageSpinner />
  return <Outlet />
}
```

`src/app/RouteError.tsx` :

```tsx
import { Button } from '../components/Button'

export function RouteError() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 pt-20 text-center">
      <h1 className="text-2xl font-semibold">Oups</h1>
      <p className="text-stone-600">Une erreur inattendue est survenue.</p>
      <Button onClick={() => window.location.reload()}>Recharger</Button>
    </main>
  )
}
```

`src/pages/NotFoundPage.tsx` :

```tsx
import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="mx-auto flex max-w-sm flex-col items-center gap-4 px-4 pt-20 text-center">
      <h1 className="text-2xl font-semibold">Page introuvable</h1>
      <Link to="/" className="font-medium text-rose-700 underline">
        Retour à mes patterns
      </Link>
    </main>
  )
}
```

- [ ] **Step 8 : Placeholders des pages (remplacés dans les Tasks 8 à 13)**

Créer chaque fichier avec son titre définitif :

```tsx
// src/pages/LoginPage.tsx
export function LoginPage() {
  return <h1>Connexion</h1>
}
```

```tsx
// src/pages/RegisterPage.tsx
export function RegisterPage() {
  return <h1>Créer un compte</h1>
}
```

```tsx
// src/pages/PatternListPage.tsx
export function PatternListPage() {
  return <h1>Mes patterns</h1>
}
```

```tsx
// src/pages/PatternDetailPage.tsx
export function PatternDetailPage() {
  return <h1>Pattern</h1>
}
```

```tsx
// src/pages/PatternFormPage.tsx
export function PatternFormPage() {
  return <h1>Nouveau pattern</h1>
}
```

```tsx
// src/pages/AccountPage.tsx
export function AccountPage() {
  return <h1>Mon compte</h1>
}
```

- [ ] **Step 9 : Routes et providers**

`src/app/routes.tsx` :

```tsx
import type { RouteObject } from 'react-router'
import { GuestOnly } from '../auth/GuestOnly'
import { RequireAuth } from '../auth/RequireAuth'
import { Layout } from '../components/Layout'
import { AccountPage } from '../pages/AccountPage'
import { LoginPage } from '../pages/LoginPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PatternDetailPage } from '../pages/PatternDetailPage'
import { PatternFormPage } from '../pages/PatternFormPage'
import { PatternListPage } from '../pages/PatternListPage'
import { RegisterPage } from '../pages/RegisterPage'
import { Root } from './Root'
import { RouteError } from './RouteError'

export const routes: RouteObject[] = [
  {
    element: <Root />,
    errorElement: <RouteError />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/register', element: <RegisterPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <Layout />,
            children: [
              { path: '/', element: <PatternListPage /> },
              { path: '/patterns/new', element: <PatternFormPage /> },
              { path: '/patterns/:id', element: <PatternDetailPage /> },
              { path: '/patterns/:id/edit', element: <PatternFormPage /> },
              { path: '/account', element: <AccountPage /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
```

`src/app/AppProviders.tsx` :

```tsx
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { ToastProvider } from '../components/toast/ToastProvider'

export function AppProviders({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  )
}
```

`src/main.tsx` :

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { createQueryClient } from './api/queryClient'
import { AppProviders } from './app/AppProviders'
import { routes } from './app/routes'
import './index.css'

const queryClient = createQueryClient()
const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
```

```bash
git rm -q src/App.tsx src/App.test.tsx
```

- [ ] **Step 10 : Helper de rendu (`src/test/renderApp.tsx`)**

```tsx
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { createQueryClient } from '../api/queryClient'
import { AppProviders } from '../app/AppProviders'
import { routes } from '../app/routes'

export function renderApp(path: string) {
  const queryClient = createQueryClient()
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const user = userEvent.setup()
  const result = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...result, user, router, queryClient }
}
```

- [ ] **Step 11 : Écrire les tests de l'app (`src/app/app.test.tsx`)**

```tsx
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { seedAccount } from '../test/db'
import { apiUrl } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

describe('démarrage et gardes', () => {
  it('redirige un visiteur vers le login avec redirect', async () => {
    const { router } = renderApp('/account')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toBe('?redirect=%2Faccount')
  })

  it('pose le cookie XSRF au démarrage', async () => {
    renderApp('/login')
    await screen.findByRole('heading', { name: 'Connexion' })
    expect(document.cookie).toContain('XSRF-TOKEN=tok-1')
  })

  it('renvoie un utilisateur connecté de /login vers redirect', async () => {
    seedAccount()
    const { router } = renderApp('/login?redirect=%2Faccount')
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('ignore un redirect externe', async () => {
    seedAccount()
    const { router } = renderApp('/login?redirect=%2F%2Fevil.example')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('affiche la 404 pour une route inconnue', async () => {
    renderApp('/nimporte/quoi')
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeInTheDocument()
  })

  it('affiche une erreur de démarrage avec Réessayer si le serveur est injoignable', async () => {
    server.use(http.get(apiUrl('/api/auth/csrf'), () => HttpResponse.error()))
    renderApp('/')
    expect(await screen.findByText('Serveur injoignable, vérifie ta connexion', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 12 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Si `mutation.meta?.skipAuthRedirect` pose un problème de typage, c'est que `meta` est `Record<string, unknown>` : le test de vérité reste valide, sinon caster en `Boolean(...)`.

- [ ] **Step 13 : Vérifier à la main**

Run : `npm run dev`, ouvrir `http://localhost:5173` avec le backend lancé.
Expected : redirection vers `/login`, où « Connexion » s'affiche. Dans les DevTools, le cookie `XSRF-TOKEN` est présent.

- [ ] **Step 14 : Commit**

```bash
git add -A
git commit -m "feat: add app shell with boot sequence, routes, auth guards and layout"
```

---

### Task 8 : Pages connexion et inscription

**Files :**
- Create : `src/lib/validation.ts`, `src/components/AuthShell.tsx`
- Modify : `src/api/queries.ts`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`
- Test : `src/lib/validation.test.ts`, `src/pages/auth.test.tsx`

**Interfaces :**
- Consumes : `login`, `register` (Task 5), `applyServerErrors`, `errorMessage` (Task 4), composants (Task 6), `queryKeys` (Task 7).
- Produces :
  - `useLogin()`, `useRegister()` : `onSuccess` écrit `me`, et `GuestOnly` redirige.
  - `lib/validation.ts` : `utf8Length(value): number`, `requiredText(value): true | string`, `maxChars(n)`, `emailRules`, `newPasswordRules`, `confirmRule(getOther: () => string)`.

- [ ] **Step 1 : Écrire les tests de `validation.ts` (`src/lib/validation.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import { emailRules, newPasswordRules, requiredText, utf8Length } from './validation'

describe('validation', () => {
  it('compte les octets UTF-8', () => {
    expect(utf8Length('abc')).toBe(3)
    expect(utf8Length('é')).toBe(2)
  })
  it('requiredText refuse les blancs', () => {
    expect(requiredText('  ')).toBe('Obligatoire')
    expect(requiredText(' a ')).toBe(true)
  })
  it('emailRules', () => {
    expect(emailRules.validate('')).toBe('Obligatoire')
    expect(emailRules.validate('ana')).toBe('Email invalide')
    expect(emailRules.validate(' ana@example.com ')).toBe(true)
    expect(emailRules.validate(`${'a'.repeat(250)}@b.fr`)).toBe('254 caractères max')
  })
  it('newPasswordRules limite à 72 octets', () => {
    expect(newPasswordRules.validate('a'.repeat(72))).toBe(true)
    expect(newPasswordRules.validate('é'.repeat(37))).toBe('Trop long : 72 octets max (les accents comptent double)')
  })
})
```

- [ ] **Step 2 : Implémenter `src/lib/validation.ts`**

```ts
export const utf8Length = (value: string): number => new TextEncoder().encode(value).length

export const requiredText = (value: string): true | string => value.trim() !== '' || 'Obligatoire'

export const maxChars = (n: number) => ({ value: n, message: `${n} caractères max` })

export const emailRules = {
  validate: (value: string): true | string => {
    const email = value.trim()
    if (email === '') return 'Obligatoire'
    if (email.length > 254) return '254 caractères max'
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || 'Email invalide'
  },
}

export const newPasswordRules = {
  required: 'Obligatoire',
  minLength: { value: 8, message: 'Au moins 8 caractères' },
  validate: (value: string): true | string =>
    utf8Length(value) <= 72 || 'Trop long : 72 octets max (les accents comptent double)',
}

export const confirmRule = (getOther: () => string) => ({
  validate: (value: string): true | string => value === getOther() || 'Les mots de passe ne correspondent pas',
})
```

Run : `npx vitest run src/lib/validation.test.ts`. Expected : PASS.

- [ ] **Step 3 : Ajouter les mutations à `src/api/queries.ts`**

Compléter les imports en tête :

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCsrf, getMe, login, register } from './auth'
```

Ajouter en fin de fichier :

```ts
export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    meta: { skipAuthRedirect: true },
    onSuccess: (account) => {
      queryClient.removeQueries({ queryKey: queryKeys.patterns })
      queryClient.setQueryData(queryKeys.me, account)
    },
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: register,
    onSuccess: (account) => {
      queryClient.removeQueries({ queryKey: queryKeys.patterns })
      queryClient.setQueryData(queryKeys.me, account)
    },
  })
}
```

- [ ] **Step 4 : `src/components/AuthShell.tsx`**

```tsx
import type { ReactNode } from 'react'

export function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <p className="text-center text-2xl font-bold text-rose-700">🧶 Crochet</p>
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
      <p className="text-center text-sm text-stone-600">{footer}</p>
    </main>
  )
}
```

- [ ] **Step 5 : Écrire les tests des pages (`src/pages/auth.test.tsx`)**

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'
import { http } from 'msw'

describe('LoginPage', () => {
  it('connecte puis redirige vers redirect', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2Faccount')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('affiche une erreur sur de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'mauvais')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect')
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('affiche le délai d’attente en cas de 429', async () => {
    server.use(
      http.post(apiUrl('/api/auth/login'), () =>
        problem(429, 'Too many attempts, try again later', { headers: { 'Retry-After': '600' } }),
      ),
    )
    const { user } = renderApp('/login')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans 10 min')
  })

  it('ne suit pas un redirect externe après connexion', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2F%5Cevil.example')
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('RegisterPage', () => {
  async function fill(user: ReturnType<typeof renderApp>['user'], email: string, password: string, confirm = password) {
    await user.type(await screen.findByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  }

  it('crée le compte et arrive sur la liste', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(db.accounts).toHaveLength(1)
  })

  it('affiche la 409 sous le champ email', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'secret123')
    expect(await screen.findByText('Cet email est déjà utilisé')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('valide côté client sans appeler l’API', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'ana@example.com', 'court', 'autre')
    expect(await screen.findByText('Au moins 8 caractères')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts).toHaveLength(0)
  })
})
```

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/auth.test.tsx`
Expected : FAIL, champs introuvables (les pages sont encore des placeholders).

- [ ] **Step 7 : Implémenter `src/pages/LoginPage.tsx`**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { useLogin } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { applyServerErrors } from '../lib/formErrors'
import { requiredText } from '../lib/validation'

interface LoginValues {
  email: string
  password: string
}

export function LoginPage() {
  const form = useForm<LoginValues>({ defaultValues: { email: '', password: '' } })
  const { register, handleSubmit, formState: { errors } } = form
  const loginMutation = useLogin()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      // Succès : `me` est écrit dans le cache, GuestOnly redirige.
      await loginMutation.mutateAsync({ email: values.email.trim(), password: values.password })
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <AuthShell
      title="Connexion"
      footer={
        <>
          Pas encore de compte ?{' '}
          <Link to={{ pathname: '/register', search: location.search }} className="font-medium text-rose-700 underline">
            Créer un compte
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormBanner message={banner} />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', { validate: requiredText })}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password', { required: 'Obligatoire' })}
        />
        <Button type="submit" loading={loginMutation.isPending}>
          Se connecter
        </Button>
      </form>
    </AuthShell>
  )
}
```

- [ ] **Step 8 : Implémenter `src/pages/RegisterPage.tsx`**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { ApiError } from '../api/client'
import { useRegister } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { errorMessage } from '../lib/errors'
import { applyServerErrors } from '../lib/formErrors'
import { confirmRule, emailRules, newPasswordRules } from '../lib/validation'

interface RegisterValues {
  email: string
  password: string
  confirm: string
}

export function RegisterPage() {
  const form = useForm<RegisterValues>({ defaultValues: { email: '', password: '', confirm: '' } })
  const { register, handleSubmit, getValues, setError, formState: { errors } } = form
  const registerMutation = useRegister()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await registerMutation.mutateAsync({ email: values.email.trim(), password: values.password })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { type: 'server', message: errorMessage(error) }, { shouldFocus: true })
      } else {
        setBanner(applyServerErrors(error, form))
      }
    }
  })

  return (
    <AuthShell
      title="Créer un compte"
      footer={
        <>
          Déjà inscrit ?{' '}
          <Link to={{ pathname: '/login', search: location.search }} className="font-medium text-rose-700 underline">
            Se connecter
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <FormBanner message={banner} />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email', emailRules)}
        />
        <TextField
          label="Mot de passe"
          type="password"
          autoComplete="new-password"
          hint="8 caractères minimum"
          error={errors.password?.message}
          {...register('password', newPasswordRules)}
        />
        <TextField
          label="Confirmer le mot de passe"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm', confirmRule(() => getValues('password')))}
        />
        <Button type="submit" loading={registerMutation.isPending}>
          Créer mon compte
        </Button>
      </form>
    </AuthShell>
  )
}
```

- [ ] **Step 9 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS.

- [ ] **Step 10 : Commit**

```bash
git add -A
git commit -m "feat: add login and register pages"
```

---

### Task 9 : Liste des patterns

**Files :**
- Create : `src/lib/format.ts`, `src/lib/url.ts`, `src/components/StatusBadge.tsx`, `src/pages/patternList/PatternCard.tsx`
- Modify : `src/api/queries.ts`, `src/pages/PatternListPage.tsx`
- Test : `src/lib/format.test.ts`, `src/pages/PatternListPage.test.tsx`

**Interfaces :**
- Consumes : `listPatterns` (Task 5), `patternState`, `PatternState` (Task 2), `Skeleton`, `ErrorState` (Task 6).
- Produces :
  - `usePatterns()`
  - `formatDate(iso: string): string` (`"12/10/2026"`), `formatHookSize(mm: number): string` (`"3,5"`)
  - `isHttpUrl(value: string | null | undefined): value is string`
  - `StatusBadge({ progress: Progress | null; stepCount: number; showFinishedDate?: boolean })`

- [ ] **Step 1 : Écrire les tests de `format.ts` et `url.ts` (`src/lib/format.test.ts`)**

```ts
import { expect, it } from 'vitest'
import { formatDate, formatHookSize } from './format'
import { isHttpUrl } from './url'

it('formatDate au format français', () => {
  expect(formatDate('2026-10-12T12:00:00Z')).toBe('12/10/2026')
})

it('formatHookSize avec une virgule', () => {
  expect(formatHookSize(3.5)).toBe('3,5')
  expect(formatHookSize(4)).toBe('4')
  expect(formatHookSize(2.25)).toBe('2,25')
})

it.each([
  ['https://ex.com/a.png', true],
  ['http://ex.com', true],
  ['javascript:alert(1)', false],
  ['data:image/png;base64,xx', false],
  ['pas une url', false],
  [null, false],
])('isHttpUrl(%j) = %j', (value, expected) => {
  expect(isHttpUrl(value)).toBe(expected)
})
```

- [ ] **Step 2 : Implémenter `src/lib/format.ts` et `src/lib/url.ts`**

```ts
const DATE = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' })
const HOOK = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 })

export const formatDate = (iso: string): string => DATE.format(new Date(iso))

export const formatHookSize = (mm: number): string => HOOK.format(mm)
```

```ts
/** Seuls http(s) sont rendus en lien ou en image : bloque javascript:, data:, etc. */
export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
```

Run : `npx vitest run src/lib/format.test.ts`. Expected : PASS.

- [ ] **Step 3 : Ajouter `usePatterns` à `src/api/queries.ts`**

Ajouter l'import `import { listPatterns } from './patterns'`, puis :

```ts
export function usePatterns() {
  return useQuery({ queryKey: queryKeys.patterns, queryFn: listPatterns })
}
```

- [ ] **Step 4 : `src/components/StatusBadge.tsx`**

```tsx
import type { Progress } from '../api/types'
import { formatDate } from '../lib/format'
import { patternState } from '../lib/progress'

const STYLES = {
  'not-started': 'bg-stone-100 text-stone-700',
  'in-progress': 'bg-amber-100 text-amber-900',
  finished: 'bg-emerald-100 text-emerald-900',
}

export function StatusBadge({
  progress,
  stepCount,
  showFinishedDate = false,
}: {
  progress: Progress | null
  stepCount: number
  showFinishedDate?: boolean
}) {
  const state = patternState(progress)
  let label = 'Non commencé'
  if (progress && state === 'in-progress') label = `En cours · étape ${progress.stepIndex + 1}/${stepCount}`
  if (progress && state === 'finished') {
    label = showFinishedDate && progress.finishedAt ? `Terminé le ${formatDate(progress.finishedAt)}` : 'Terminé'
  }
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[state]}`}>{label}</span>
}
```

- [ ] **Step 5 : `src/pages/patternList/PatternCard.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import type { PatternSummary } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { formatHookSize } from '../../lib/format'
import { isHttpUrl } from '../../lib/url'

function Thumbnail({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false)
  if (!isHttpUrl(src) || failed) {
    return <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-xl bg-rose-50 text-2xl">🧶</div>
  }
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="size-16 shrink-0 rounded-xl object-cover" />
}

export function PatternCard({ pattern }: { pattern: PatternSummary }) {
  const meta = [pattern.hookSizeMm !== null ? `${formatHookSize(pattern.hookSizeMm)} mm` : null, pattern.yarn]
    .filter(Boolean)
    .join(' · ')
  return (
    <Link to={`/patterns/${pattern.id}`} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-stone-200 active:bg-stone-50">
      <Thumbnail src={pattern.imageUrl} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="truncate font-semibold">{pattern.title}</h2>
        {meta && <p className="truncate text-sm text-stone-500">{meta}</p>}
        <div>
          <StatusBadge progress={pattern.progress} stepCount={pattern.stepCount} />
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 6 : Écrire les tests (`src/pages/PatternListPage.test.tsx`)**

```tsx
import { screen, within } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

function seedThree() {
  const account = seedAccount()
  seedPattern(account.id, { title: 'Chat' })
  seedPattern(account.id, { title: 'Ours', progress: progressAt(1, 0), hookSizeMm: 3.5, yarn: 'Coton' })
  seedPattern(account.id, { title: 'Abeille', progress: progressAt(1, 0, 'FINISHED') })
}

describe('PatternListPage', () => {
  it('liste les patterns avec leur état', async () => {
    seedThree()
    renderApp('/')
    const items = await screen.findAllByRole('listitem')
    expect(items.map((item) => within(item).getByRole('heading').textContent)).toEqual(['Abeille', 'Chat', 'Ours'])
    expect(screen.getByText('Non commencé')).toBeInTheDocument()
    expect(screen.getByText('En cours · étape 2/2')).toBeInTheDocument()
    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText('3,5 mm · Coton')).toBeInTheDocument()
  })

  it('filtre côté client', async () => {
    seedThree()
    const { user } = renderApp('/')
    await screen.findAllByRole('listitem')
    await user.click(screen.getByRole('button', { name: 'En cours' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Ours' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Non commencés' }))
    expect(screen.getByRole('heading', { name: 'Chat' })).toBeInTheDocument()
  })

  it('affiche un état vide avec une invitation', async () => {
    seedAccount()
    renderApp('/')
    expect(await screen.findByText('Aucun pattern pour l’instant.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Créer mon premier pattern' })).toHaveAttribute('href', '/patterns/new')
  })

  it('renvoie au login sur une 401', async () => {
    seedAccount()
    server.use(http.get(apiUrl('/api/patterns'), () => problem(401, 'Authentication required')))
    const { router } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?redirect=%2F')
  })

  it('ouvre la création via le bouton +', async () => {
    seedAccount()
    renderApp('/')
    expect(await screen.findByRole('link', { name: 'Nouveau pattern' })).toHaveAttribute('href', '/patterns/new')
  })
})
```

- [ ] **Step 7 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/PatternListPage.test.tsx`
Expected : FAIL (la page est encore un placeholder).

- [ ] **Step 8 : Implémenter `src/pages/PatternListPage.tsx`**

```tsx
import { useState } from 'react'
import { Link } from 'react-router'
import { usePatterns } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { patternState, type PatternState } from '../lib/progress'
import { PatternCard } from './patternList/PatternCard'

type Filter = 'all' | PatternState

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'finished', label: 'Terminés' },
  { value: 'not-started', label: 'Non commencés' },
]

export function PatternListPage() {
  const { data, isPending, isError, error, refetch } = usePatterns()
  const [filter, setFilter] = useState<Filter>('all')

  const visible = (data ?? []).filter((pattern) => filter === 'all' || patternState(pattern.progress) === filter)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes patterns</h1>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {isError && <ErrorState error={error} onRetry={() => void refetch()} />}

      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-stone-600">Aucun pattern pour l’instant.</p>
          <Link to="/patterns/new" className="rounded-xl bg-rose-600 px-4 py-3 font-medium text-white">
            Créer mon premier pattern
          </Link>
        </div>
      )}

      {data && data.length > 0 && (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
                  filter === value ? 'bg-rose-600 text-white' : 'bg-white text-stone-700 ring-1 ring-stone-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-stone-600">Aucun pattern dans cette catégorie.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {visible.map((pattern) => (
                <li key={pattern.id}>
                  <PatternCard pattern={pattern} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Link
        to="/patterns/new"
        aria-label="Nouveau pattern"
        className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-rose-600 text-3xl text-white shadow-lg active:bg-rose-700"
      >
        +
      </Link>
    </div>
  )
}
```

- [ ] **Step 9 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS.

- [ ] **Step 10 : Commit**

```bash
git add -A
git commit -m "feat: add pattern list with status badges and filters"
```

---

### Task 10 : Détail d'un pattern et avancement (optimiste)

**Files :**
- Create :
  - `src/lib/patternId.ts`, `src/components/PatternNotFound.tsx` ;
  - `src/pages/patternDetail/PatternDetail.tsx`, `PatternInfo.tsx`, `StepList.tsx`, `ProgressActions.tsx`, `useProgressActions.ts`.
- Modify : `src/api/queries.ts`, `src/pages/PatternDetailPage.tsx`
- Test : `src/lib/patternId.test.ts`, `src/pages/PatternDetailPage.test.tsx`

**Interfaces :**
- Consumes : `getPattern`, `putProgress` (Task 5), fonctions de `lib/progress.ts` (Task 2), `errorMessage`, `isNotFound` (Task 4), `useToast`, `Button` (Task 6), `StatusBadge`, `isHttpUrl`, `formatHookSize` (Task 9).
- Produces :
  - `parsePatternId(raw: string | undefined): number | null`
  - `usePattern(id: number | null)`
  - `useUpdateProgress(patternId: number, options?: { onError?: (error: unknown) => void })` : mutation `ProgressInput → Progress`, optimiste et sérialisée.
  - `interface ProgressActionsApi { start(); next(); prev(); finish(); reopen(); selectRow(stepIndex, rowIndex) }`
  - `useProgressActions(patternId): ProgressActionsApi`
  - `PatternDetail({ pattern })` (étendu dans la Task 11), `PatternNotFound()`

- [ ] **Step 1 : Tests et implémentation de `parsePatternId`**

`src/lib/patternId.test.ts` :

```ts
import { expect, it } from 'vitest'
import { parsePatternId } from './patternId'

it.each([
  ['12', 12],
  ['abc', null],
  ['0', null],
  ['-3', null],
  ['1.5', null],
  [undefined, null],
  ['99999999999999999999', null],
])('parsePatternId(%j) = %j', (raw, expected) => {
  expect(parsePatternId(raw)).toBe(expected)
})
```

`src/lib/patternId.ts` :

```ts
export function parsePatternId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null
  const id = Number(raw)
  return id > 0 && Number.isSafeInteger(id) ? id : null
}
```

Run : `npx vitest run src/lib/patternId.test.ts`. Expected : PASS.

- [ ] **Step 2 : Ajouter `usePattern` et `useUpdateProgress` à `src/api/queries.ts`**

Compléter les imports :

```ts
import { getPattern, listPatterns, putProgress } from './patterns'
import type { Pattern, ProgressInput } from './types'
import { optimisticProgress } from '../lib/progress'
```

Ajouter :

```ts
export function usePattern(id: number | null) {
  return useQuery({
    queryKey: queryKeys.pattern(id ?? 0),
    queryFn: () => getPattern(id as number),
    enabled: id !== null,
  })
}

/**
 * Mises à jour d'avancement optimistes, sérialisées par pattern (scope) pour
 * encaisser les appuis rapides : chaque position est calculée depuis le cache courant.
 */
export function useUpdateProgress(patternId: number, options: { onError?: (error: unknown) => void } = {}) {
  const queryClient = useQueryClient()
  const key = queryKeys.pattern(patternId)
  const mutationKey = ['progress', patternId]
  return useMutation({
    mutationKey,
    scope: { id: `progress-${patternId}` },
    mutationFn: (input: ProgressInput) => putProgress(patternId, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true })
      const previous = queryClient.getQueryData<Pattern>(key)
      if (previous) queryClient.setQueryData<Pattern>(key, { ...previous, progress: optimisticProgress(previous.progress, input) })
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      options.onError?.(error)
    },
    onSuccess: (progress) => {
      // Une mutation plus récente est en file : on ne réécrit pas sa position optimiste.
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        queryClient.setQueryData<Pattern>(key, (pattern) => (pattern ? { ...pattern, progress } : pattern))
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true }),
  })
}
```

- [ ] **Step 3 : `src/pages/patternDetail/useProgressActions.ts`**

```ts
import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { queryKeys, useUpdateProgress } from '../../api/queries'
import type { Pattern, Position, ProgressStatus, Step } from '../../api/types'
import { useToast } from '../../components/toast/useToast'
import { errorMessage } from '../../lib/errors'
import { nextPosition, prevPosition } from '../../lib/progress'

export interface ProgressActionsApi {
  start: () => void
  next: () => void
  prev: () => void
  finish: () => void
  reopen: () => void
  selectRow: (stepIndex: number, rowIndex: number) => void
}

export function useProgressActions(patternId: number): ProgressActionsApi {
  const queryClient = useQueryClient()
  const toast = useToast()
  const { mutate } = useUpdateProgress(patternId, { onError: (error) => toast.show(errorMessage(error), 'error') })

  return useMemo(() => {
    // Toujours lire le cache au moment de l'appui, jamais la valeur capturée au rendu.
    const current = () => queryClient.getQueryData<Pattern>(queryKeys.pattern(patternId))

    const move = (compute: (steps: Step[], pos: Position) => Position | null) => {
      const pattern = current()
      if (!pattern?.progress) return
      const position = compute(pattern.steps, pattern.progress)
      if (position) mutate({ status: 'IN_PROGRESS', ...position })
    }

    const setStatus = (status: ProgressStatus) => {
      const progress = current()?.progress
      if (!progress) return
      mutate({ status, stepIndex: progress.stepIndex, rowIndex: progress.rowIndex })
    }

    return {
      start: () => mutate({ status: 'IN_PROGRESS', stepIndex: 0, rowIndex: 0 }),
      next: () => move(nextPosition),
      prev: () => move(prevPosition),
      finish: () => setStatus('FINISHED'),
      reopen: () => setStatus('IN_PROGRESS'),
      selectRow: (stepIndex, rowIndex) =>
        mutate({ status: current()?.progress?.status ?? 'IN_PROGRESS', stepIndex, rowIndex }),
    }
  }, [queryClient, patternId, mutate])
}
```

- [ ] **Step 4 : `src/components/PatternNotFound.tsx`**

```tsx
import { Link } from 'react-router'

export function PatternNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Pattern introuvable</h1>
      <p className="text-stone-600">Il a peut-être été supprimé.</p>
      <Link to="/" className="font-medium text-rose-700 underline">
        Retour à la liste
      </Link>
    </div>
  )
}
```

- [ ] **Step 5 : `src/pages/patternDetail/PatternInfo.tsx`**

```tsx
import type { Pattern } from '../../api/types'
import { StatusBadge } from '../../components/StatusBadge'
import { formatHookSize } from '../../lib/format'
import { isHttpUrl } from '../../lib/url'

export function PatternInfo({ pattern }: { pattern: Pattern }) {
  const meta = [pattern.hookSizeMm !== null ? `Crochet ${formatHookSize(pattern.hookSizeMm)} mm` : null, pattern.yarn]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="flex flex-col gap-3">
      {isHttpUrl(pattern.imageUrl) && (
        <img src={pattern.imageUrl} alt="" className="max-h-64 w-full rounded-2xl object-cover" />
      )}
      {meta && <p className="text-stone-600">{meta}</p>}
      {isHttpUrl(pattern.sourceUrl) && (
        <a href={pattern.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-rose-700 underline">
          Source ↗
        </a>
      )}
      {pattern.description && (
        <details className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
          <summary className="cursor-pointer font-medium">Description</summary>
          <p className="mt-2 whitespace-pre-wrap text-stone-700">{pattern.description}</p>
        </details>
      )}
      <div>
        <StatusBadge progress={pattern.progress} stepCount={pattern.steps.length} showFinishedDate />
      </div>
    </section>
  )
}
```

- [ ] **Step 6 : `src/pages/patternDetail/StepList.tsx`**

```tsx
import { useEffect, useState } from 'react'
import type { Progress, Step } from '../../api/types'
import { compareToCurrent, type RowState } from '../../lib/progress'

const ROW_STYLES: Record<RowState, string> = {
  past: 'text-stone-400',
  current: 'bg-rose-100 text-lg font-semibold text-stone-900 ring-2 ring-rose-500',
  future: 'text-stone-800',
}

interface StepListProps {
  steps: Step[]
  progress: Progress | null
  onSelectRow: (stepIndex: number, rowIndex: number) => void
}

export function StepList({ steps, progress, onSelectRow }: StepListProps) {
  // Centre le rang courant à l'ouverture et à chaque déplacement.
  useEffect(() => {
    document.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [progress?.stepIndex, progress?.rowIndex])

  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, stepIndex) => (
        <StepSection key={stepIndex} step={step} stepIndex={stepIndex} progress={progress} onSelectRow={onSelectRow} />
      ))}
    </ol>
  )
}

function StepSection({
  step,
  stepIndex,
  progress,
  onSelectRow,
}: {
  step: Step
  stepIndex: number
  progress: Progress | null
  onSelectRow: StepListProps['onSelectRow']
}) {
  const isPast = progress !== null && stepIndex < progress.stepIndex
  const isCurrent = progress !== null && stepIndex === progress.stepIndex
  const [open, setOpen] = useState(!isPast)
  const isOpen = open || isCurrent

  return (
    <li className="rounded-2xl bg-white p-2 ring-1 ring-stone-200">
      <h2>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={() => setOpen(!isOpen)}
          className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left font-semibold ${isPast ? 'text-stone-400' : ''}`}
        >
          <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          {stepIndex + 1}. {step.title}
        </button>
      </h2>
      {isOpen && (
        <ol className="mt-1 flex flex-col gap-1">
          {step.rows.map((row, rowIndex) => {
            const state = compareToCurrent(stepIndex, rowIndex, progress)
            return (
              <li key={rowIndex}>
                <button
                  type="button"
                  aria-label={`Rang ${row.number} : ${row.value}`}
                  aria-current={state === 'current' ? 'step' : undefined}
                  onClick={() => onSelectRow(stepIndex, rowIndex)}
                  className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-2 py-2 text-left ${ROW_STYLES[state]}`}
                >
                  <span className="w-12 shrink-0 font-mono text-sm leading-7">{row.number}</span>
                  <span className="whitespace-pre-wrap">{row.value}</span>
                </button>
              </li>
            )
          })}
        </ol>
      )}
    </li>
  )
}
```

- [ ] **Step 7 : `src/pages/patternDetail/ProgressActions.tsx`**

```tsx
import type { Pattern } from '../../api/types'
import { Button } from '../../components/Button'
import { formatDate } from '../../lib/format'
import { isFirstRow, isLastRow, patternState } from '../../lib/progress'
import type { ProgressActionsApi } from './useProgressActions'

export function ProgressActions({ pattern, actions }: { pattern: Pattern; actions: ProgressActionsApi }) {
  const { progress, steps } = pattern
  const state = patternState(progress)

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        {state === 'not-started' && (
          <Button className="h-14 flex-1 text-lg" onClick={actions.start}>
            Démarrer
          </Button>
        )}
        {state === 'in-progress' && progress && (
          <>
            <Button
              variant="secondary"
              className="h-14 w-28"
              aria-label="Rang précédent"
              disabled={isFirstRow(steps, progress)}
              onClick={actions.prev}
            >
              ◀ Préc.
            </Button>
            {isLastRow(steps, progress) ? (
              <Button className="h-14 flex-1 text-lg" onClick={actions.finish}>
                Terminer ✓
              </Button>
            ) : (
              <Button className="h-14 flex-1 text-lg" onClick={actions.next}>
                Rang suivant ▶
              </Button>
            )}
          </>
        )}
        {state === 'finished' && progress && (
          <>
            <p className="flex-1 font-medium text-emerald-800">
              {progress.finishedAt ? `Terminé le ${formatDate(progress.finishedAt)}` : 'Terminé'}
            </p>
            <Button variant="secondary" className="h-14" onClick={actions.reopen}>
              Rouvrir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8 : `src/pages/patternDetail/PatternDetail.tsx`**

```tsx
import { Link } from 'react-router'
import type { Pattern } from '../../api/types'
import { PatternInfo } from './PatternInfo'
import { ProgressActions } from './ProgressActions'
import { StepList } from './StepList'
import { useProgressActions } from './useProgressActions'

export function PatternDetail({ pattern }: { pattern: Pattern }) {
  const actions = useProgressActions(pattern.id)

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Retour à la liste" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{pattern.title}</h1>
      </header>
      <PatternInfo pattern={pattern} />
      <StepList steps={pattern.steps} progress={pattern.progress} onSelectRow={actions.selectRow} />
      <ProgressActions pattern={pattern} actions={actions} />
    </div>
  )
}
```

- [ ] **Step 9 : Remplacer `src/pages/PatternDetailPage.tsx`**

```tsx
import { useParams } from 'react-router'
import { usePattern } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { PatternNotFound } from '../components/PatternNotFound'
import { Skeleton } from '../components/Skeleton'
import { isNotFound } from '../lib/errors'
import { parsePatternId } from '../lib/patternId'
import { PatternDetail } from './patternDetail/PatternDetail'

export function PatternDetailPage() {
  const patternId = parsePatternId(useParams().id)
  const query = usePattern(patternId)

  if (patternId === null) return <PatternNotFound />
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (query.isError) {
    return isNotFound(query.error) ? <PatternNotFound /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  return <PatternDetail pattern={query.data} />
}
```

- [ ] **Step 10 : Écrire les tests (`src/pages/PatternDetailPage.test.tsx`)**

```tsx
import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

const row = (value: string) => screen.getByRole('button', { name: (name) => name.includes(value) })

/** Steps par défaut : Tête [6ms dans cercle (6), 6aug (12)], Corps [12ms (12)]. */
function setup(overrides: Parameters<typeof seedPattern>[1] = {}) {
  const account = seedAccount()
  const pattern = seedPattern(account.id, overrides)
  return { pattern, ...renderApp(`/patterns/${pattern.id}`) }
}

describe('PatternDetailPage', () => {
  it('démarre un pattern non commencé', async () => {
    const { user, pattern } = setup()
    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))
    expect(await screen.findByRole('button', { name: /Rang suivant/ })).toBeInTheDocument()
    expect(row('6ms dans cercle (6)')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress).toMatchObject({ stepIndex: 0, rowIndex: 0 }))
  })

  it('passe d’une étape à l’autre, termine puis rouvre', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 1) })
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(row('12ms (12)')).toHaveAttribute('aria-current', 'step')

    await user.click(await screen.findByRole('button', { name: /Terminer/ }))
    expect(await screen.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.status).toBe('FINISHED'))

    await user.click(screen.getByRole('button', { name: 'Rouvrir' }))
    expect(await screen.findByRole('button', { name: /Terminer/ })).toBeInTheDocument()
    await waitFor(() => expect(db.patterns.find((p) => p.id === pattern.id)?.progress?.finishedAt).toBeNull())
  })

  it('désactive Précédent au premier rang et recule ensuite', async () => {
    const { user } = setup({ progress: progressAt(1, 0) })
    await user.click(await screen.findByRole('button', { name: 'Rang précédent' }))
    expect(row('6aug (12)')).toHaveAttribute('aria-current', 'step')
    await user.click(screen.getByRole('button', { name: 'Rang précédent' }))
    expect(screen.getByRole('button', { name: 'Rang précédent' })).toBeDisabled()
  })

  it('met l’UI à jour avant la réponse du serveur', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const { user, pattern } = setup({ progress: progressAt(0, 0) })
    // Retient la requête puis la laisse passer au handler par défaut (le resolver ne renvoie rien).
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), async () => {
      await gate
    }))
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(row('6aug (12)')).toHaveAttribute('aria-current', 'step')
    expect(db.patterns[0].progress?.rowIndex).toBe(0)
    release()
    await waitFor(() => expect(db.patterns[0].progress?.rowIndex).toBe(1))
  })

  it('annule et affiche un toast si le serveur échoue', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 0) })
    server.use(http.put(apiUrl(`/api/patterns/${pattern.id}/progress`), () => problem(500, 'Internal error')))
    await user.click(await screen.findByRole('button', { name: /Rang suivant/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur inattendue, réessaie plus tard')
    expect(row('6ms dans cercle (6)')).toHaveAttribute('aria-current', 'step')
  })

  it('encaisse un double appui rapide', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id, {
      steps: [{ title: 'Unique', rows: [{ number: '1', value: 'A1' }, { number: '2', value: 'A2' }, { number: '3', value: 'A3' }] }],
      progress: progressAt(0, 0),
    })
    const { user } = renderApp(`/patterns/${pattern.id}`)
    const next = await screen.findByRole('button', { name: /Rang suivant/ })
    await user.click(next)
    await user.click(screen.getByRole('button', { name: /Terminer|Rang suivant/ }))
    expect(row('A3')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns[0].progress?.rowIndex).toBe(2))
    expect(row('A3')).toHaveAttribute('aria-current', 'step')
  })

  it('touche un rang pour en faire la position courante', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: (name) => name.includes('12ms (12)') }))
    expect(row('12ms (12)')).toHaveAttribute('aria-current', 'step')
    await waitFor(() => expect(db.patterns[0].progress).toMatchObject({ status: 'IN_PROGRESS', stepIndex: 1, rowIndex: 0 }))
  })

  it('affiche « Pattern introuvable » sur une 404', async () => {
    seedAccount()
    renderApp('/patterns/999')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
  })

  it('affiche « Pattern introuvable » pour un id invalide, sans appel API', async () => {
    seedAccount()
    let calls = 0
    server.use(http.get(apiUrl('/api/patterns/:id'), () => {
      calls += 1
    }))
    renderApp('/patterns/abc')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('ne rend pas de lien ni d’image pour une URL non http(s)', async () => {
    setup({ sourceUrl: 'javascript:alert(1)', imageUrl: 'javascript:alert(2)' })
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(screen.queryByRole('link', { name: /Source/ })).not.toBeInTheDocument()
    expect(document.querySelector('img')).toBeNull()
  })

  it('rend la source http(s) en lien externe', async () => {
    setup({ sourceUrl: 'https://ex.com/lapin', hookSizeMm: 3.5, yarn: 'Coton' })
    expect(await screen.findByRole('link', { name: /Source/ })).toHaveAttribute('href', 'https://ex.com/lapin')
    expect(screen.getByText('Crochet 3,5 mm · Coton')).toBeInTheDocument()
  })
})
```

- [ ] **Step 11 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Si le test « double appui » échoue parce que le second clic arrive avant le rendu, ne pas l'affaiblir : vérifier que `useProgressActions` lit bien `getQueryData` (Step 3) et que `onSuccess` respecte `isMutating`.

- [ ] **Step 12 : Vérifier à la main sur mobile**

Run : `npm run dev -- --host`, puis ouvrir depuis le téléphone (même réseau ; le CORS du backend n'autorise que `localhost:5173`, donc tester plutôt avec les DevTools en mode mobile si besoin).
Expected : la barre du bas reste dans la zone du pouce, et le rang courant est centré après chaque appui.

- [ ] **Step 13 : Commit**

```bash
git add -A
git commit -m "feat: add pattern detail with optimistic progress tracking"
```

---

### Task 11 : Menu du détail (modifier, terminer, abandonner, supprimer) et écran toujours allumé

**Files :**
- Create : `src/hooks/useWakeLock.ts`, `src/hooks/useKeepAwakePreference.ts`, `src/pages/patternDetail/PatternMenu.tsx`
- Modify : `src/api/queries.ts`, `src/pages/patternDetail/PatternDetail.tsx`
- Test : `src/pages/PatternDetailMenu.test.tsx`

**Interfaces :**
- Consumes : `deleteProgress`, `deletePattern` (Task 5), `isNotStarted`, `errorMessage` (Task 4), `ConfirmDialog`, `useToast` (Task 6), `ProgressActionsApi` (Task 10).
- Produces :
  - `useAbandonProgress(patternId)` : une 404 « is not started » compte comme un succès.
  - `useDeletePattern(patternId)`
  - `useWakeLock(active: boolean): void`
  - `useKeepAwakePreference(): [boolean, (value: boolean) => void]` (clé `crochet.keepAwake`, `true` par défaut)
  - `PatternMenu({ pattern, actions, keepAwake, onKeepAwakeChange, onAbandon, onDelete })`

- [ ] **Step 1 : Ajouter les mutations à `src/api/queries.ts`**

Compléter les imports :

```ts
import { deletePattern, deleteProgress, getPattern, listPatterns, putProgress } from './patterns'
import { isNotStarted } from '../lib/errors'
```

Ajouter :

```ts
export function useAbandonProgress(patternId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await deleteProgress(patternId)
      } catch (error) {
        // Déjà non commencé (abandon depuis un autre appareil) : c'est le résultat voulu.
        if (!isNotStarted(error)) throw error
      }
    },
    onSuccess: () => {
      queryClient.setQueryData<Pattern>(queryKeys.pattern(patternId), (pattern) =>
        pattern ? { ...pattern, progress: null } : pattern,
      )
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.pattern(patternId), exact: true })
      await queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })
    },
  })
}

export function useDeletePattern(patternId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => deletePattern(patternId),
    onSuccess: () => {
      queryClient.setQueryData<PatternSummary[]>(queryKeys.patterns, (list) => list?.filter((p) => p.id !== patternId))
      void queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })
    },
  })
}
```

Ajouter `PatternSummary` à l'import de types : `import type { Pattern, PatternSummary, ProgressInput } from './types'`.

- [ ] **Step 2 : `src/hooks/useKeepAwakePreference.ts`**

```ts
import { useCallback, useState } from 'react'

const KEY = 'crochet.keepAwake'

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'false'
  } catch {
    return true
  }
}

export function useKeepAwakePreference(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(read)
  const update = useCallback((next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(KEY, String(next))
    } catch {
      // stockage indisponible (navigation privée) : on garde le choix en mémoire
    }
  }, [])
  return [value, update]
}
```

- [ ] **Step 3 : `src/hooks/useWakeLock.ts`**

```ts
import { useEffect } from 'react'

/** Garde l'écran allumé tant que `active` ; redemande le verrou au retour sur l'onglet. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const request = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
        else sentinel = lock
      } catch {
        // refusé (économie d'énergie, permissions) : sans conséquence
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void request()
    }

    void request()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release().catch(() => undefined)
    }
  }, [active])
}
```

- [ ] **Step 4 : `src/pages/patternDetail/PatternMenu.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { Pattern } from '../../api/types'
import { patternState } from '../../lib/progress'
import type { ProgressActionsApi } from './useProgressActions'

interface PatternMenuProps {
  pattern: Pattern
  actions: ProgressActionsApi
  keepAwake: boolean
  onKeepAwakeChange: (value: boolean) => void
  onAbandon: () => void
  onDelete: () => void
}

const ITEM = 'flex min-h-11 w-full items-center rounded-lg px-3 text-left hover:bg-stone-100'

export function PatternMenu({ pattern, actions, keepAwake, onKeepAwakeChange, onAbandon, onDelete }: PatternMenuProps) {
  const [open, setOpen] = useState(false)
  const state = patternState(pattern.progress)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const run = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Actions du pattern"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-xl text-2xl hover:bg-stone-100"
      >
        ⋯
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-50 mt-1 w-64 rounded-xl bg-white p-1 shadow-lg ring-1 ring-stone-200">
            <Link role="menuitem" to={`/patterns/${pattern.id}/edit`} className={ITEM}>
              Modifier
            </Link>
            {state === 'in-progress' && (
              <button role="menuitem" type="button" className={ITEM} onClick={run(actions.finish)}>
                Terminer
              </button>
            )}
            {state !== 'not-started' && (
              <button role="menuitem" type="button" className={ITEM} onClick={run(onAbandon)}>
                Abandonner l’avancement
              </button>
            )}
            <button role="menuitem" type="button" className={`${ITEM} text-red-700`} onClick={run(onDelete)}>
              Supprimer le pattern
            </button>
            <label className={`${ITEM} gap-3 border-t border-stone-100`}>
              <input
                type="checkbox"
                checked={keepAwake}
                onChange={(event) => onKeepAwakeChange(event.target.checked)}
                className="size-5 accent-rose-600"
              />
              Écran toujours allumé
            </label>
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 5 : Brancher le menu, les confirmations et le wake lock dans `src/pages/patternDetail/PatternDetail.tsx`**

Remplacer le fichier :

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAbandonProgress, useDeletePattern } from '../../api/queries'
import type { Pattern } from '../../api/types'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useToast } from '../../components/toast/useToast'
import { useKeepAwakePreference } from '../../hooks/useKeepAwakePreference'
import { useWakeLock } from '../../hooks/useWakeLock'
import { errorMessage } from '../../lib/errors'
import { patternState } from '../../lib/progress'
import { PatternInfo } from './PatternInfo'
import { PatternMenu } from './PatternMenu'
import { ProgressActions } from './ProgressActions'
import { StepList } from './StepList'
import { useProgressActions } from './useProgressActions'

type Confirm = 'abandon' | 'delete' | null

export function PatternDetail({ pattern }: { pattern: Pattern }) {
  const actions = useProgressActions(pattern.id)
  const abandon = useAbandonProgress(pattern.id)
  const remove = useDeletePattern(pattern.id)
  const toast = useToast()
  const navigate = useNavigate()
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [keepAwake, setKeepAwake] = useKeepAwakePreference()

  useWakeLock(keepAwake && patternState(pattern.progress) === 'in-progress')

  const onError = (error: unknown) => {
    setConfirm(null)
    toast.show(errorMessage(error), 'error')
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="Retour à la liste" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{pattern.title}</h1>
        <PatternMenu
          pattern={pattern}
          actions={actions}
          keepAwake={keepAwake}
          onKeepAwakeChange={setKeepAwake}
          onAbandon={() => setConfirm('abandon')}
          onDelete={() => setConfirm('delete')}
        />
      </header>
      <PatternInfo pattern={pattern} />
      <StepList steps={pattern.steps} progress={pattern.progress} onSelectRow={actions.selectRow} />
      <ProgressActions pattern={pattern} actions={actions} />

      <ConfirmDialog
        open={confirm === 'abandon'}
        title="Abandonner l’avancement ?"
        message="Ta position sera effacée et le pattern redeviendra non commencé."
        confirmLabel="Abandonner"
        danger
        loading={abandon.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() => abandon.mutate(undefined, { onSuccess: () => setConfirm(null), onError })}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        title="Supprimer ce pattern ?"
        message="Le pattern et son avancement seront définitivement supprimés."
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Pattern supprimé', 'success')
              navigate('/', { replace: true })
            },
            onError,
          })
        }
      />
    </div>
  )
}
```

- [ ] **Step 6 : Écrire les tests (`src/pages/PatternDetailMenu.test.tsx`)**

```tsx
import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

function setup(overrides: Parameters<typeof seedPattern>[1] = {}) {
  const account = seedAccount()
  const pattern = seedPattern(account.id, overrides)
  return { pattern, ...renderApp(`/patterns/${pattern.id}`) }
}

async function openMenu(user: ReturnType<typeof renderApp>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Actions du pattern' }))
}

describe('menu du détail', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'wakeLock')
  })

  it('abandonne l’avancement après confirmation', async () => {
    const { user } = setup({ progress: progressAt(0, 1) })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Abandonner l’avancement' }))
    await user.click(screen.getByRole('button', { name: 'Abandonner' }))
    expect(await screen.findByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
    expect(db.patterns[0].progress).toBeNull()
  })

  it('traite « is not started » comme un abandon réussi', async () => {
    const { user, pattern } = setup({ progress: progressAt(0, 1) })
    server.use(
      http.delete(apiUrl(`/api/patterns/${pattern.id}/progress`), () => problem(404, `Pattern ${pattern.id} is not started`)),
    )
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Abandonner l’avancement' }))
    await user.click(screen.getByRole('button', { name: 'Abandonner' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('supprime le pattern et revient à la liste', async () => {
    const { user } = setup()
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le pattern' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(await screen.findByText('Pattern supprimé')).toBeInTheDocument()
    expect(db.patterns).toHaveLength(0)
  })

  it('termine depuis le menu au milieu du pattern', async () => {
    const { user } = setup({ progress: progressAt(0, 0) })
    await openMenu(user)
    await user.click(screen.getByRole('menuitem', { name: 'Terminer' }))
    expect(await screen.findByRole('button', { name: 'Rouvrir' })).toBeInTheDocument()
  })

  it('propose Modifier vers le formulaire', async () => {
    const { user, pattern } = setup()
    await openMenu(user)
    expect(screen.getByRole('menuitem', { name: 'Modifier' })).toHaveAttribute('href', `/patterns/${pattern.id}/edit`)
  })

  it('garde l’écran allumé en cours, et respecte l’interrupteur', async () => {
    const release = vi.fn().mockResolvedValue(undefined)
    const request = vi.fn().mockResolvedValue({ released: false, release })
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })

    const { user } = setup({ progress: progressAt(0, 0) })
    await waitFor(() => expect(request).toHaveBeenCalledWith('screen'))

    await openMenu(user)
    await user.click(screen.getByRole('checkbox', { name: 'Écran toujours allumé' }))
    await waitFor(() => expect(release).toHaveBeenCalled())
    expect(localStorage.getItem('crochet.keepAwake')).toBe('false')
  })
})
```

- [ ] **Step 7 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "feat: add detail menu (edit, finish, abandon, delete) and screen wake lock"
```

---

### Task 12 : Formulaire de création et d'édition

**Files :**
- Create : `src/pages/patternForm/formModel.ts`, `src/pages/patternForm/StepFields.tsx`, `src/pages/patternForm/PatternForm.tsx`
- Modify : `src/api/queries.ts`, `src/pages/PatternFormPage.tsx`
- Test : `src/pages/patternForm/formModel.test.ts`, `src/pages/PatternFormPage.test.tsx`

**Interfaces :**
- Consumes :
  - `createPattern`, `updatePattern` (Task 5) ;
  - `applyServerErrors`, `scheduleFocusFirstError` (Task 4) ;
  - `requiredText`, `maxChars` (Task 8) ;
  - `nextRowNumber` (Task 2) ;
  - `isHttpUrl` (Task 9) ;
  - `usePattern`, `parsePatternId`, `PatternNotFound` (Task 10) ;
  - composants (Task 6).
- Produces :
  - `RowValues`, `StepValues`, `PatternFormValues` ; `emptyRow(number?)`, `emptyStep()`, `emptyForm()`
  - `toFormValues(pattern: Pattern): PatternFormValues`, `toPatternInput(values): PatternInput`
  - `parseHookSize(raw): number | null`, `validateHookSize(raw): true | string`
  - `useSavePattern(patternId?: number)`

- [ ] **Step 1 : Écrire les tests du modèle (`src/pages/patternForm/formModel.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'
import type { Pattern } from '../../api/types'
import { emptyForm, parseHookSize, toFormValues, toPatternInput, validateHookSize } from './formModel'

describe('formModel', () => {
  it('convertit les champs vides en null et trim les textes', () => {
    const values = {
      ...emptyForm(),
      title: '  Lapin ',
      hookSizeMm: '3,5',
      steps: [{ title: ' Tête ', rows: [{ number: ' 1 ', value: ' 6ms ' }] }],
    }
    expect(toPatternInput(values)).toEqual({
      title: 'Lapin',
      description: null,
      hookSizeMm: 3.5,
      yarn: null,
      sourceUrl: null,
      imageUrl: null,
      steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms' }] }],
    })
  })

  it('pré-remplit depuis un pattern (null → "", point → virgule)', () => {
    const pattern = {
      id: 1, title: 'Lapin', description: null, hookSizeMm: 3.5, yarn: 'Coton', sourceUrl: null, imageUrl: null,
      createdAt: '', updatedAt: '', progress: null,
      steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms' }] }],
    } satisfies Pattern
    expect(toFormValues(pattern)).toMatchObject({ description: '', hookSizeMm: '3,5', yarn: 'Coton', sourceUrl: '' })
  })

  it('parse et valide la taille du crochet', () => {
    expect(parseHookSize('')).toBeNull()
    expect(parseHookSize('4')).toBe(4)
    expect(parseHookSize('2,25')).toBe(2.25)
    expect(validateHookSize('')).toBe(true)
    expect(validateHookSize('99,99')).toBe(true)
    expect(validateHookSize('3,555')).toBe('Nombre positif, 2 décimales max (ex : 3,5)')
    expect(validateHookSize('100')).toBe('Nombre positif, 2 décimales max (ex : 3,5)')
    expect(validateHookSize('abc')).toBe('Nombre positif, 2 décimales max (ex : 3,5)')
    expect(validateHookSize('0')).toBe('Doit être supérieur à 0')
  })
})
```

- [ ] **Step 2 : Implémenter `src/pages/patternForm/formModel.ts`**

```ts
import type { Pattern, PatternInput } from '../../api/types'

export interface RowValues {
  number: string
  value: string
}

export interface StepValues {
  title: string
  rows: RowValues[]
}

export interface PatternFormValues {
  title: string
  description: string
  hookSizeMm: string
  yarn: string
  sourceUrl: string
  imageUrl: string
  steps: StepValues[]
}

export const emptyRow = (number = ''): RowValues => ({ number, value: '' })
export const emptyStep = (): StepValues => ({ title: '', rows: [emptyRow()] })
export const emptyForm = (): PatternFormValues => ({
  title: '',
  description: '',
  hookSizeMm: '',
  yarn: '',
  sourceUrl: '',
  imageUrl: '',
  steps: [emptyStep()],
})

export function toFormValues(pattern: Pattern): PatternFormValues {
  return {
    title: pattern.title,
    description: pattern.description ?? '',
    hookSizeMm: pattern.hookSizeMm === null ? '' : String(pattern.hookSizeMm).replace('.', ','),
    yarn: pattern.yarn ?? '',
    sourceUrl: pattern.sourceUrl ?? '',
    imageUrl: pattern.imageUrl ?? '',
    steps: pattern.steps.map((step) => ({
      title: step.title,
      rows: step.rows.map((row) => ({ number: row.number, value: row.value })),
    })),
  }
}

const normalizeDecimal = (raw: string) => raw.trim().replace(',', '.')

export function parseHookSize(raw: string): number | null {
  const value = normalizeDecimal(raw)
  return value === '' ? null : Number(value)
}

export function validateHookSize(raw: string): true | string {
  const value = normalizeDecimal(raw)
  if (value === '') return true
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(value)) return 'Nombre positif, 2 décimales max (ex : 3,5)'
  if (Number(value) <= 0) return 'Doit être supérieur à 0'
  return true
}

const optional = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

export function toPatternInput(values: PatternFormValues): PatternInput {
  return {
    title: values.title.trim(),
    description: optional(values.description),
    hookSizeMm: parseHookSize(values.hookSizeMm),
    yarn: optional(values.yarn),
    sourceUrl: optional(values.sourceUrl),
    imageUrl: optional(values.imageUrl),
    steps: values.steps.map((step) => ({
      title: step.title.trim(),
      rows: step.rows.map((row) => ({ number: row.number.trim(), value: row.value.trim() })),
    })),
  }
}
```

Run : `npx vitest run src/pages/patternForm/formModel.test.ts`. Expected : PASS.

- [ ] **Step 3 : Ajouter `useSavePattern` à `src/api/queries.ts`**

Compléter l'import : `import { createPattern, deletePattern, deleteProgress, getPattern, listPatterns, putProgress, updatePattern } from './patterns'` et ajouter `PatternInput` à l'import de types.

```ts
export function useSavePattern(patternId?: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PatternInput) => (patternId === undefined ? createPattern(input) : updatePattern(patternId, input)),
    onSuccess: (pattern) => {
      queryClient.setQueryData(queryKeys.pattern(pattern.id), pattern)
      void queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })
    },
  })
}
```

- [ ] **Step 4 : `src/pages/patternForm/StepFields.tsx`**

```tsx
import { useState } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Button } from '../../components/Button'
import { IconButton } from '../../components/IconButton'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { nextRowNumber } from '../../lib/rowNumber'
import { maxChars, requiredText } from '../../lib/validation'
import { emptyRow, type PatternFormValues } from './formModel'

interface StepFieldsProps {
  index: number
  count: number
  form: UseFormReturn<PatternFormValues>
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function StepFields({ index, count, form, onMoveUp, onMoveDown, onRemove }: StepFieldsProps) {
  const { register, control, getValues, formState: { errors } } = form
  const rows = useFieldArray({ control, name: `steps.${index}.rows` })
  const stepErrors = errors.steps?.[index]
  const [open, setOpen] = useState(true)
  const isOpen = open || stepErrors !== undefined
  const n = index + 1

  const addRow = () => {
    const last = getValues(`steps.${index}.rows.${rows.fields.length - 1}.number`) ?? ''
    rows.append(emptyRow(nextRowNumber(last)), { focusName: `steps.${index}.rows.${rows.fields.length}.value` })
  }

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-stone-200">
      <div className="flex items-start gap-1">
        <IconButton label={isOpen ? `Replier l’étape ${n}` : `Déplier l’étape ${n}`} aria-expanded={isOpen} onClick={() => setOpen(!isOpen)}>
          {isOpen ? '▾' : '▸'}
        </IconButton>
        <TextField
          className="flex-1"
          label={`Titre de l’étape ${n}`}
          hideLabel
          placeholder={`Étape ${n} (ex : Tête)`}
          error={stepErrors?.title?.message}
          {...register(`steps.${index}.title`, { validate: requiredText, maxLength: maxChars(200) })}
        />
        <IconButton label={`Monter l’étape ${n}`} disabled={index === 0} onClick={onMoveUp}>
          ↑
        </IconButton>
        <IconButton label={`Descendre l’étape ${n}`} disabled={index === count - 1} onClick={onMoveDown}>
          ↓
        </IconButton>
        <IconButton label={`Supprimer l’étape ${n}`} disabled={count === 1} onClick={onRemove}>
          🗑
        </IconButton>
      </div>

      {!isOpen && (
        <p className="px-12 text-sm text-stone-500">
          {rows.fields.length} rang{rows.fields.length > 1 ? 's' : ''}
        </p>
      )}

      {isOpen && (
        <>
          <ol className="flex flex-col gap-2">
            {rows.fields.map((row, r) => {
              const rowErrors = stepErrors?.rows?.[r]
              return (
                <li key={row.id} className="flex items-start gap-2">
                  <TextField
                    className="w-16 shrink-0"
                    label={`Numéro du rang ${r + 1} de l’étape ${n}`}
                    hideLabel
                    placeholder="N°"
                    error={rowErrors?.number?.message}
                    {...register(`steps.${index}.rows.${r}.number`, { validate: requiredText, maxLength: maxChars(20) })}
                  />
                  <TextArea
                    className="flex-1"
                    label={`Instructions du rang ${r + 1} de l’étape ${n}`}
                    hideLabel
                    rows={1}
                    placeholder="ex : 6ms dans un cercle magique (6)"
                    error={rowErrors?.value?.message}
                    {...register(`steps.${index}.rows.${r}.value`, { validate: requiredText })}
                  />
                  <IconButton
                    label={`Supprimer le rang ${r + 1} de l’étape ${n}`}
                    disabled={rows.fields.length === 1}
                    onClick={() => rows.remove(r)}
                  >
                    🗑
                  </IconButton>
                </li>
              )
            })}
          </ol>
          <Button variant="ghost" className="self-start" aria-label={`Ajouter un rang à l’étape ${n}`} onClick={addRow}>
            + Rang
          </Button>
        </>
      )}
    </fieldset>
  )
}
```

- [ ] **Step 5 : `src/pages/patternForm/PatternForm.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { Link, useBlocker, useNavigate } from 'react-router'
import { useSavePattern } from '../../api/queries'
import type { Pattern } from '../../api/types'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormBanner } from '../../components/FormBanner'
import { TextArea } from '../../components/TextArea'
import { TextField } from '../../components/TextField'
import { applyServerErrors, scheduleFocusFirstError } from '../../lib/formErrors'
import { isHttpUrl } from '../../lib/url'
import { maxChars, requiredText } from '../../lib/validation'
import { emptyForm, emptyStep, toFormValues, toPatternInput, validateHookSize, type PatternFormValues } from './formModel'
import { StepFields } from './StepFields'

export function PatternForm({ pattern }: { pattern?: Pattern }) {
  const form = useForm<PatternFormValues>({
    defaultValues: pattern ? toFormValues(pattern) : emptyForm(),
    shouldFocusError: false,
  })
  const { register, control, handleSubmit, formState: { errors, isDirty, isSubmitting } } = form
  const steps = useFieldArray({ control, name: 'steps' })
  const imageUrl = useWatch({ control, name: 'imageUrl' })
  const save = useSavePattern(pattern?.id)
  const navigate = useNavigate()
  const [banner, setBanner] = useState<string | null>(null)
  const saved = useRef(false)

  // Pas de blocage après succès, ni vers /login (session expirée : la redirection doit passer).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !saved.current && nextLocation.pathname !== '/login' && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (!isDirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const onSubmit = handleSubmit(
    async (values) => {
      setBanner(null)
      try {
        const result = await save.mutateAsync(toPatternInput(values))
        saved.current = true
        navigate(`/patterns/${result.id}`, { replace: true })
      } catch (error) {
        setBanner(applyServerErrors(error, form))
      }
    },
    () => scheduleFocusFirstError(form),
  )

  const backTo = pattern ? `/patterns/${pattern.id}` : '/'

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <header className="flex items-center gap-2">
        <Link to={backTo} aria-label="Retour" className="grid size-11 shrink-0 place-items-center rounded-xl text-xl hover:bg-stone-100">
          ←
        </Link>
        <h1 className="text-xl font-semibold">{pattern ? 'Modifier le pattern' : 'Nouveau pattern'}</h1>
      </header>

      {pattern?.progress && (
        <FormBanner
          tone="info"
          message="Si tu supprimes le rang en cours, l’avancement sera recalé sur le dernier rang existant."
        />
      )}
      <FormBanner message={banner} />

      <section className="flex flex-col gap-4">
        <TextField label="Titre *" error={errors.title?.message} {...register('title', { validate: requiredText, maxLength: maxChars(200) })} />
        <TextArea label="Description" rows={2} {...register('description')} />
        <TextField
          label="Taille du crochet (mm)"
          inputMode="decimal"
          placeholder="3,5"
          error={errors.hookSizeMm?.message}
          {...register('hookSizeMm', { validate: validateHookSize })}
        />
        <TextField label="Laine" error={errors.yarn?.message} {...register('yarn', { maxLength: maxChars(200) })} />
        <TextField
          label="URL source"
          type="url"
          inputMode="url"
          error={errors.sourceUrl?.message}
          {...register('sourceUrl', { maxLength: maxChars(500) })}
        />
        <div className="flex items-end gap-3">
          <TextField
            className="flex-1"
            label="URL image"
            type="url"
            inputMode="url"
            error={errors.imageUrl?.message}
            {...register('imageUrl', { maxLength: maxChars(500) })}
          />
          {isHttpUrl(imageUrl) && <img src={imageUrl} alt="Aperçu" className="size-11 rounded-xl object-cover" />}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Étapes</h2>
        {steps.fields.map((field, index) => (
          <StepFields
            key={field.id}
            index={index}
            count={steps.fields.length}
            form={form}
            onMoveUp={() => steps.move(index, index - 1)}
            onMoveDown={() => steps.move(index, index + 1)}
            onRemove={() => steps.remove(index)}
          />
        ))}
        <Button variant="secondary" aria-label="Ajouter une étape" onClick={() => steps.append(emptyStep())}>
          + Étape
        </Button>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto max-w-2xl">
          <Button type="submit" className="h-14 w-full text-lg" loading={isSubmitting}>
            Enregistrer
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Quitter sans enregistrer ?"
        message="Tes modifications seront perdues."
        confirmLabel="Quitter"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </form>
  )
}
```

- [ ] **Step 6 : Remplacer `src/pages/PatternFormPage.tsx`**

```tsx
import { useParams } from 'react-router'
import { usePattern } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { PatternNotFound } from '../components/PatternNotFound'
import { Skeleton } from '../components/Skeleton'
import { isNotFound } from '../lib/errors'
import { parsePatternId } from '../lib/patternId'
import { PatternForm } from './patternForm/PatternForm'

export function PatternFormPage() {
  const rawId = useParams().id
  if (rawId === undefined) return <PatternForm />
  return <EditPattern rawId={rawId} />
}

function EditPattern({ rawId }: { rawId: string }) {
  const patternId = parsePatternId(rawId)
  const query = usePattern(patternId)

  if (patternId === null) return <PatternNotFound />
  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (query.isError) {
    return isNotFound(query.error) ? <PatternNotFound /> : <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  }
  return <PatternForm key={query.data.id} pattern={query.data} />
}
```

- [ ] **Step 7 : Écrire les tests (`src/pages/PatternFormPage.test.tsx`)**

```tsx
import { screen, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

type User = ReturnType<typeof renderApp>['user']

async function fillMinimal(user: User) {
  await user.type(await screen.findByLabelText('Titre *'), 'Lapin')
  await user.type(screen.getByLabelText('Titre de l’étape 1'), 'Tête')
  await user.type(screen.getByLabelText('Numéro du rang 1 de l’étape 1'), '1')
  await user.type(screen.getByLabelText('Instructions du rang 1 de l’étape 1'), '6ms (6)')
}

describe('création', () => {
  it('crée un pattern et ouvre son détail', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.type(screen.getByLabelText('Taille du crochet (mm)'), '3,5')
    await user.click(screen.getByRole('button', { name: 'Ajouter un rang à l’étape 1' }))
    expect(screen.getByLabelText('Numéro du rang 2 de l’étape 1')).toHaveValue('2')
    expect(screen.getByLabelText('Instructions du rang 2 de l’étape 1')).toHaveFocus()
    await user.type(screen.getByLabelText('Instructions du rang 2 de l’étape 1'), '6aug (12)')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(db.patterns[0]).toMatchObject({
      title: 'Lapin',
      hookSizeMm: 3.5,
      description: null,
      yarn: null,
      steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms (6)' }, { number: '2', value: '6aug (12)' }] }],
    })
  })

  it('valide côté client et met le focus sur le premier champ en erreur', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.click(await screen.findByRole('button', { name: 'Enregistrer' }))
    expect((await screen.findAllByText('Obligatoire')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.getByLabelText('Titre *')).toHaveFocus())
    expect(db.patterns).toHaveLength(0)
  })

  it('refuse une taille de crochet invalide', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.type(screen.getByLabelText('Taille du crochet (mm)'), '3,555')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByText('Nombre positif, 2 décimales max (ex : 3,5)')).toBeInTheDocument()
  })

  it('affiche les erreurs serveur sur le bon champ et les autres dans le bandeau', async () => {
    seedAccount()
    server.use(
      http.post(apiUrl('/api/patterns'), () =>
        problem(400, 'Validation failed', {
          errors: [
            { field: 'steps[0].rows[0].value', message: 'must not be blank' },
            { field: 'steps', message: 'must not be empty' },
          ],
        }),
      ),
    )
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    const field = screen.getByLabelText('Instructions du rang 1 de l’étape 1')
    await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'))
    expect(field).toHaveAccessibleDescription('Obligatoire')
    expect(screen.getByRole('alert')).toHaveTextContent('Ne doit pas être vide')
  })

  it('ajoute une étape avec un rang vide', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.click(await screen.findByRole('button', { name: 'Ajouter une étape' }))
    expect(screen.getByLabelText('Titre de l’étape 2')).toHaveValue('')
    expect(screen.getByLabelText('Numéro du rang 1 de l’étape 2')).toHaveValue('')
  })

  it('demande confirmation avant de quitter avec des modifications', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await user.type(await screen.findByLabelText('Titre *'), 'X')
    await user.click(screen.getByRole('link', { name: 'Retour' }))
    expect(screen.getByRole('alertdialog', { name: 'Quitter sans enregistrer ?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(screen.getByLabelText('Titre *')).toHaveValue('X')
    await user.click(screen.getByRole('link', { name: 'Retour' }))
    await user.click(screen.getByRole('button', { name: 'Quitter' }))
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
  })

  it('redirige vers le login sans dialogue si la session a expiré', async () => {
    seedAccount()
    server.use(http.post(apiUrl('/api/patterns'), () => problem(401, 'Authentication required')))
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})

describe('édition', () => {
  it('pré-remplit, modifie et enregistre le pattern complet', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id, { hookSizeMm: 3.5, progress: progressAt(0, 1) })
    const { user } = renderApp(`/patterns/${pattern.id}/edit`)

    const title = await screen.findByLabelText('Titre *')
    expect(title).toHaveValue('Lapin')
    expect(screen.getByLabelText('Taille du crochet (mm)')).toHaveValue('3,5')
    expect(screen.getByText(/l’avancement sera recalé/)).toBeInTheDocument()

    await user.clear(title)
    await user.type(title, 'Lapin bleu')
    await user.click(screen.getByRole('button', { name: 'Supprimer le rang 2 de l’étape 1' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByRole('heading', { name: 'Lapin bleu' })).toBeInTheDocument()
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(db.patterns[0].steps[0].rows).toHaveLength(1)
    expect(db.patterns[0].progress).toMatchObject({ stepIndex: 0, rowIndex: 0 })
  })

  it('réordonne les étapes', async () => {
    const account = seedAccount()
    const pattern = seedPattern(account.id)
    const { user } = renderApp(`/patterns/${pattern.id}/edit`)
    await user.click(await screen.findByRole('button', { name: 'Descendre l’étape 1' }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].steps.map((step) => step.title)).toEqual(['Corps', 'Tête'])
  })

  it('affiche « Pattern introuvable » pour un pattern inexistant', async () => {
    seedAccount()
    renderApp('/patterns/999/edit')
    expect(await screen.findByRole('heading', { name: 'Pattern introuvable' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 8 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Si le focus après « + Rang » n'est pas sur l'instruction, vérifier que l'option `focusName` d'`append` vise bien l'index `rows.fields.length` (calculé avant l'ajout).

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat: add pattern create/edit form with dynamic steps and rows"
```

---

### Task 13 : Page compte

**Files :**
- Create : `src/pages/account/ChangePasswordForm.tsx`, `src/pages/account/DeleteAccountForm.tsx`
- Modify : `src/api/queries.ts`, `src/pages/AccountPage.tsx`
- Test : `src/pages/AccountPage.test.tsx`

**Interfaces :**
- Consumes : `logout`, `changePassword`, `deleteAccount` (Task 5), `newPasswordRules`, `confirmRule` (Task 8), `formatDate` (Task 9), `applyServerErrors` (Task 4), composants (Task 6).
- Produces : `useLogout()`, `useChangePassword()`, `useDeleteAccount()`. Une déconnexion ou une suppression réussie purge les patterns du cache et met `me` à `null`, puis `RequireAuth` envoie vers `/login`.

- [ ] **Step 1 : Ajouter les mutations à `src/api/queries.ts`**

Compléter l'import : `import { changePassword, deleteAccount, fetchCsrf, getMe, login, logout, register } from './auth'`.

```ts
function clearSession(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({ queryKey: queryKeys.patterns })
  queryClient.setQueryData(queryKeys.me, null)
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: logout, onSuccess: () => clearSession(queryClient) })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: deleteAccount, onSuccess: () => clearSession(queryClient) })
}
```

- [ ] **Step 2 : `src/pages/account/ChangePasswordForm.tsx`**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useChangePassword } from '../../api/queries'
import { Button } from '../../components/Button'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { useToast } from '../../components/toast/useToast'
import { applyServerErrors } from '../../lib/formErrors'
import { confirmRule, newPasswordRules } from '../../lib/validation'

interface Values {
  currentPassword: string
  newPassword: string
  confirm: string
}

export function ChangePasswordForm() {
  const form = useForm<Values>({ defaultValues: { currentPassword: '', newPassword: '', confirm: '' } })
  const { register, handleSubmit, getValues, reset, formState: { errors } } = form
  const mutation = useChangePassword()
  const toast = useToast()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setBanner(null)
    try {
      await mutation.mutateAsync({ currentPassword, newPassword })
      reset()
      toast.show('Mot de passe modifié', 'success')
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">Changer le mot de passe</h2>
      <FormBanner message={banner} />
      <TextField
        label="Mot de passe actuel"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword', { required: 'Obligatoire' })}
      />
      <TextField
        label="Nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        hint="8 caractères minimum"
        error={errors.newPassword?.message}
        {...register('newPassword', newPasswordRules)}
      />
      <TextField
        label="Confirmer le nouveau mot de passe"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register('confirm', confirmRule(() => getValues('newPassword')))}
      />
      <Button type="submit" loading={mutation.isPending}>
        Modifier le mot de passe
      </Button>
    </form>
  )
}
```

- [ ] **Step 3 : `src/pages/account/DeleteAccountForm.tsx`**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDeleteAccount } from '../../api/queries'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { applyServerErrors } from '../../lib/formErrors'

export function DeleteAccountForm() {
  const form = useForm<{ password: string }>({ defaultValues: { password: '' } })
  const { register, handleSubmit, getValues, formState: { errors } } = form
  const mutation = useDeleteAccount()
  const [confirming, setConfirming] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(() => {
    setBanner(null)
    setConfirming(true)
  })

  const onConfirm = async () => {
    try {
      // Succès : `me` passe à null, RequireAuth renvoie vers /login.
      await mutation.mutateAsync(getValues('password'))
    } catch (error) {
      setConfirming(false)
      setBanner(applyServerErrors(error, form))
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-red-50 p-4 ring-1 ring-red-200">
      <h2 className="text-lg font-semibold text-red-800">Zone danger</h2>
      <p className="text-sm text-red-900">La suppression du compte efface définitivement tous tes patterns.</p>
      <FormBanner message={banner} />
      <TextField
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password', { required: 'Obligatoire' })}
      />
      <Button type="submit" variant="danger">
        Supprimer mon compte
      </Button>
      <ConfirmDialog
        open={confirming}
        title="Supprimer ton compte ?"
        message="Ton compte et tous tes patterns seront supprimés. Cette action est irréversible."
        confirmLabel="Supprimer définitivement"
        danger
        loading={mutation.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void onConfirm()}
      />
    </form>
  )
}
```

- [ ] **Step 4 : Remplacer `src/pages/AccountPage.tsx`**

```tsx
import { useLogout, useMe } from '../api/queries'
import { Button } from '../components/Button'
import { useToast } from '../components/toast/useToast'
import { errorMessage } from '../lib/errors'
import { formatDate } from '../lib/format'
import { ChangePasswordForm } from './account/ChangePasswordForm'
import { DeleteAccountForm } from './account/DeleteAccountForm'

export function AccountPage() {
  const { data: me } = useMe()
  const logout = useLogout()
  const toast = useToast()

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mon compte</h1>
      {me && (
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="font-medium">{me.email}</p>
          <p className="text-sm text-stone-500">Inscrit le {formatDate(me.createdAt)}</p>
        </section>
      )}
      <ChangePasswordForm />
      <Button
        variant="secondary"
        loading={logout.isPending}
        onClick={() => logout.mutate(undefined, { onError: (error) => toast.show(errorMessage(error), 'error') })}
      >
        Se déconnecter
      </Button>
      <DeleteAccountForm />
    </div>
  )
}
```

- [ ] **Step 5 : Écrire les tests (`src/pages/AccountPage.test.tsx`)**

```tsx
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, seedAccount, seedPattern } from '../test/db'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof renderApp>['user']

async function changePassword(user: User, current: string, next: string, confirm = next) {
  await user.type(await screen.findByLabelText('Mot de passe actuel'), current)
  await user.type(screen.getByLabelText('Nouveau mot de passe'), next)
  await user.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), confirm)
  await user.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))
}

describe('AccountPage', () => {
  it('affiche l’email et la date d’inscription', async () => {
    seedAccount()
    renderApp('/account')
    expect(await screen.findByText('ana@example.com')).toBeInTheDocument()
    expect(screen.getByText('Inscrit le 12/10/2026')).toBeInTheDocument()
  })

  it('change le mot de passe', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'secret123', 'nouveau123')
    expect(await screen.findByText('Mot de passe modifié')).toBeInTheDocument()
    expect(db.accounts[0].password).toBe('nouveau123')
    expect(screen.getByLabelText('Mot de passe actuel')).toHaveValue('')
  })

  it('signale un mot de passe actuel incorrect sous le champ', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'mauvais', 'nouveau123')
    const field = screen.getByLabelText('Mot de passe actuel')
    await waitFor(() => expect(field).toHaveAccessibleDescription('Mot de passe incorrect'))
  })

  it('vérifie la confirmation côté client', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changePassword(user, 'secret123', 'nouveau123', 'autre123')
    expect(await screen.findByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts[0].password).toBe('secret123')
  })

  it('déconnecte et renvoie au login', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await user.click(await screen.findByRole('button', { name: 'Se déconnecter' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(db.sessionAccountId).toBeNull()
  })

  it('refuse la suppression avec un mauvais mot de passe', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await user.type(await screen.findByLabelText('Mot de passe'), 'mauvais')
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer définitivement' }))
    await waitFor(() => expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription('Mot de passe incorrect'))
    expect(db.accounts).toHaveLength(1)
  })

  it('supprime le compte après confirmation', async () => {
    const account = seedAccount()
    seedPattern(account.id)
    const { user } = renderApp('/account')
    await user.type(await screen.findByLabelText('Mot de passe'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' })
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))
    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
    expect(db.accounts).toHaveLength(0)
    expect(db.patterns).toHaveLength(0)
  })
})
```

> Note : `getByLabelText('Mot de passe')` est une correspondance exacte, elle ne capte donc pas « Mot de passe actuel ».

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat: add account page (password change, logout, account deletion)"
```

---

### Task 14 : Finitions, README et validation contre le vrai backend

**Files :**
- Modify : `README.md`

- [ ] **Step 1 : Remplacer `README.md`**

````markdown
# crochet_front

Front React de suivi de patterns de crochet, pour l'API `crochet_back` (voir `doc/front-api.md`).

## Démarrer

```bash
npm install
cp .env.example .env.local   # VITE_API_URL, par défaut http://localhost:8080
npm run dev                  # http://localhost:5173 (origine autorisée par le CORS du backend)
```

Le backend doit tourner sur `http://localhost:8080`. En production, le front doit partager le domaine parent de l'API (cookie de session `SameSite=Lax`).

## Scripts

| Commande | Rôle |
|---|---|
| `npm run dev` | serveur de dev |
| `npm run build` | vérification TypeScript + build |
| `npm run lint` | oxlint |
| `npm test` | tests (Vitest + Testing Library + MSW) |

## Structure

- `src/api/` : client HTTP (session cookie + CSRF), endpoints, hooks TanStack Query
- `src/lib/` : logique pure (navigation dans les rangs, erreurs, validation)
- `src/pages/` : écrans ; `src/components/` : UI partagée
- `src/test/` : faux backend MSW en mémoire utilisé par les tests

Design : `docs/superpowers/specs/2026-10-12-crochet-front-design.md`.
````

- [ ] **Step 2 : Validation complète**

Run : `npm run build && npm run lint && npm test`
Expected : build OK, lint sans erreur, tous les tests PASS.

- [ ] **Step 3 : Recette manuelle contre le vrai backend**

Backend lancé, `npm run dev`, DevTools en mode mobile (iPhone/Pixel) :
1. Inscription, puis arrivée sur la liste vide avec l'invitation.
2. Création d'un pattern avec 2 étapes et 3 rangs (« 1 », « 2 », « 3-5 », puis `+ Rang` doit proposer « 6 »).
3. Détail : Démarrer, puis Rang suivant (changement d'étape), Précédent, appui sur un rang, Terminer, Rouvrir. Le cookie `XSRF-TOKEN` change après le login, et aucune 403 n'apparaît dans l'onglet réseau.
4. Édition : suppression du rang courant, puis enregistrement. Sur le détail, le rang courant est recadré.
5. Menu : Abandonner, puis Supprimer.
6. Compte : changement de mot de passe (mauvais mot de passe actuel, puis bon), déconnexion, reconnexion, puis suppression du compte.
7. 5 logins ratés : message « Trop de tentatives, réessaie dans N min ».

Noter tout écart. S'il touche le contrat API, le confronter à `doc/front-api.md` avant de corriger.

- [ ] **Step 4 : Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for crochet_front"
```
