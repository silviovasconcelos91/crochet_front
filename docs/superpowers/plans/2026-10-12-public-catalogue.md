# Pseudo, visibilité et catalogue public — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** aligner le front sur la nouvelle API (connexion par pseudo, visibilité privé/public, catalogue public, avancement par compte, changement de pseudo).

**Architecture :**
- On garde l'architecture existante. Les ruptures se corrigent dans la couche API (client, messages, endpoints). Le faux backend MSW apprend les nouvelles règles : pseudo, visibilité, avancement par compte, 403.
- Chaque écran évolue ensuite séparément : accueil à onglets, détail, formulaire, compte.
- La logique pure va dans `src/lib/` : fusion des listes, règles du pseudo, traductions.

**Tech Stack :** React 19, TypeScript 6, Vite 8, Tailwind v4, react-router 7.18, TanStack Query 5, react-hook-form 7, Vitest 5 + jsdom + Testing Library + MSW 2.

**Spec :** `docs/superpowers/specs/2026-10-12-public-catalogue-design.md` (complète `docs/superpowers/specs/2026-10-12-crochet-front-design.md`). **API :** `doc/front-api.md`.

## Global Constraints

- Aucun endpoint ni champ en dehors de `doc/front-api.md`.
- `PatternInput.visibility` est **toujours** envoyé, sur `POST` comme sur `PUT`. Omis, il vaut `PRIVATE`.
- Le nouvel essai CSRF après une 403 n'a lieu que si le corps est absent ou illisible, ou si `detail === 'Access denied'`.
- Règle du pseudo, après trim : `/^[\p{L}\p{N}_.-]{3,30}$/u`. Message : « 3 à 30 caractères : lettres, chiffres, _ - . »
- Toute l'UI est en français, au tutoiement. Cibles tactiles d'au moins 44 px (`min-h-11` / `size-11`).
- Aucune nouvelle dépendance.
- Avant le merge : `npm run build`, `npm run lint` et `npm test` passent sans erreur. Le seul avertissement de lint accepté est le `react(refs)` connu de `PatternForm.tsx`.

## Review Focus

1. **Éditer un pattern public sans toucher à la visibilité** : il reste public, car le `PUT` renvoie `visibility: 'PUBLIC'`. Test dans la Task 6.
2. **403 `belongs to another account`** : aucun appel à `/api/auth/csrf` ni nouvel essai ; message « Ce pattern appartient à un autre compte ». Tests dans les Tasks 1 et 6.
3. **Deux comptes avancent sur le même pattern public** : l'avancement de l'un ne bouge pas celui de l'autre. Test dans la Task 3.
4. **Pseudo accentué ou tapé dans une autre casse** : « Éloïse » est accepté côté client, et la connexion avec « ANA » fonctionne pour le compte « ana ». Tests dans les Tasks 1 et 2.
5. **Un auteur repasse en privé un pattern que j'avais commencé** : il disparaît de « Mes patterns » au rechargement des listes. Test dans la Task 4.

---

## Structure des fichiers

| Fichier | Rôle | Tâche |
|---|---|---|
| `src/api/client.ts` | nouvel essai CSRF limité à `Access denied` | 1 |
| `src/lib/errors.ts` | messages 401/403/409, traduction selon le champ | 1 |
| `src/lib/formErrors.ts` | transmet le champ à la traduction | 1 |
| `src/lib/validation.ts` | `usernameRules` | 1 |
| `src/api/types.ts` | `Visibility`, `Author`, `username`, `visibility/author/mine` | 2, 3 |
| `src/api/auth.ts` | login/register par pseudo, `changeUsername` | 2, 7 |
| `src/api/patterns.ts` | `listPublicPatterns` | 3 |
| `src/api/queries.ts` | `usePublicPatterns`, `invalidateLists`, `useChangeUsername` | 3, 7 |
| `src/test/db.ts`, `src/test/handlers.ts` | faux backend : pseudo, visibilité, avancement par compte | 2, 3, 7 |
| `src/pages/LoginPage.tsx`, `RegisterPage.tsx` | pseudo | 2 |
| `src/lib/patternLists.ts` | `mergeMyPatterns` | 4 |
| `src/components/VisibilityBadge.tsx` | badge Public/Privé | 4 |
| `src/pages/PatternListPage.tsx`, `patternList/PatternCard.tsx` | onglets, auteur, badge | 4 |
| `src/pages/patternDetail/PatternInfo.tsx`, `PatternMenu.tsx`, `PatternDetail.tsx` | auteur, actions réservées à l'auteur | 5 |
| `src/pages/patternForm/formModel.ts`, `PatternForm.tsx`, `src/pages/PatternFormPage.tsx` | visibilité, confirmation, refus pour un non-auteur | 6 |
| `src/pages/account/ChangeUsernameForm.tsx`, `src/pages/AccountPage.tsx`, `src/components/Layout.tsx` | pseudo | 7 |

---

### Task 1 : Client, messages et règles du pseudo

**Files :**
- Modify : `src/api/client.ts`, `src/lib/errors.ts`, `src/lib/formErrors.ts`, `src/lib/validation.ts`
- Test : `src/api/client.test.ts`, `src/lib/errors.test.ts`, `src/lib/formErrors.test.ts`, `src/lib/validation.test.ts`

**Interfaces :**
- Produces :
  - `translateServerMessage(message: string, field?: string): string`
  - `usernameRules: { validate(value: string): true | string }`
  - `errorMessage` gère 401 `Invalid username or password`, 403 `belongs to another account` et 409 générique.

- [ ] **Step 1 : Créer la branche**

```bash
git checkout -b feat/public-catalogue
```

- [ ] **Step 2 : Test client, la 403 « autre compte » n'est pas rejouée (`src/api/client.test.ts`)**

Ajouter dans le `describe('api')`, après `'ne rejoue pas un GET en 403'` :

```ts
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
```

- [ ] **Step 3 : Tests des messages (`src/lib/errors.test.ts`)**

Dans le `it.each` de `errorMessage`, remplacer les lignes 401 et 409 :

```ts
    [apiError(401, 'Invalid email or password'), 'Email ou mot de passe incorrect'],
```

par

```ts
    [apiError(401, 'Invalid username or password'), 'Pseudo ou mot de passe incorrect'],
    [apiError(403, 'Pattern 3 belongs to another account'), 'Ce pattern appartient à un autre compte'],
```

et

```ts
    [apiError(409, 'Email already used'), 'Cet email est déjà utilisé'],
```

par

```ts
    [apiError(409, 'Already used'), 'Pseudo ou email déjà utilisé'],
```

Puis ajouter, à la fin du fichier :

```ts
describe('translateServerMessage selon le champ', () => {
  it.each([
    ['is already used', 'username', 'Ce pseudo est déjà pris'],
    ['is already used', 'email', 'Cet email est déjà utilisé'],
    ['is already used', undefined, 'Déjà utilisé'],
    ["must be 3 to 30 letters, digits, '_', '-' or '.'", 'username', '3 à 30 caractères : lettres, chiffres, _ - .'],
    ['must not be blank', 'username', 'Obligatoire'],
  ])('%s sur %s', (message, field, expected) => {
    expect(translateServerMessage(message, field)).toBe(expected)
  })
})
```

- [ ] **Step 4 : Test du mapping d'une 409 sur les deux champs (`src/lib/formErrors.test.ts`)**

Ajouter dans `describe('applyServerErrors')` :

```ts
  it('traduit une 409 selon le champ', () => {
    const form = makeForm({ username: '', email: '' })
    const error = new ApiError(409, {
      status: 409,
      detail: 'Already used',
      errors: [
        { field: 'username', message: 'is already used' },
        { field: 'email', message: 'is already used' },
      ],
    }, null)
    expect(applyServerErrors(error, form as never)).toBeNull()
    expect(form.setError).toHaveBeenCalledWith('username', { type: 'server', message: 'Ce pseudo est déjà pris' })
    expect(form.setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Cet email est déjà utilisé' })
  })
```

- [ ] **Step 5 : Tests de `usernameRules` (`src/lib/validation.test.ts`)**

Remplacer l'import par :

```ts
import { emailRules, newPasswordRules, requiredText, usernameRules, utf8Length } from './validation'
```

Ajouter dans `describe('validation')` :

```ts
  it.each([
    ['ana', true],
    [' ana ', true],
    ['Éloïse', true],
    ['jean-luc.d_1', true],
    ['ab', '3 à 30 caractères : lettres, chiffres, _ - .'],
    ['a b c', '3 à 30 caractères : lettres, chiffres, _ - .'],
    ['ana@x', '3 à 30 caractères : lettres, chiffres, _ - .'],
    ['a'.repeat(31), '3 à 30 caractères : lettres, chiffres, _ - .'],
    ['   ', 'Obligatoire'],
  ])('usernameRules(%j)', (value, expected) => {
    expect(usernameRules.validate(value)).toBe(expected)
  })
```

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/api/client.test.ts src/lib`
Expected : FAIL sur les nouveaux cas, avec « usernameRules is undefined », des messages différents et un `fetchMock` appelé 3 fois.

- [ ] **Step 7 : Client, nouvel essai CSRF limité (`src/api/client.ts`)**

Remplacer :

```ts
  if (response.status === 403 && options.method !== undefined && options.method !== 'GET') {
```

par :

```ts
  if (response.status === 403 && options.method !== undefined && options.method !== 'GET' && (await isCsrfDenial(response))) {
```

et ajouter, à la fin du fichier :

```ts
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
```

- [ ] **Step 8 : Messages (`src/lib/errors.ts`)**

Dans `errorMessage`, remplacer les cas 401, 403 et 409 par :

```ts
    case 401:
      return error.problem?.detail === 'Invalid username or password'
        ? 'Pseudo ou mot de passe incorrect'
        : 'Session expirée, reconnecte-toi'
    case 403:
      return error.problem?.detail?.endsWith('belongs to another account')
        ? 'Ce pattern appartient à un autre compte'
        : 'Session invalide, recharge la page'
```

```ts
    case 409:
      return 'Pseudo ou email déjà utilisé'
```

Ajouter dans `TRANSLATIONS` :

```ts
  [/^must be 3 to 30 letters, digits, '_', '-' or '\.'$/, '3 à 30 caractères : lettres, chiffres, _ - .'],
```

Remplacer `translateServerMessage` par :

```ts
/** Messages dont la traduction dépend du champ concerné. */
const BY_FIELD: Record<string, Record<string, string>> = {
  'is already used': { username: 'Ce pseudo est déjà pris', email: 'Cet email est déjà utilisé' },
}

export function translateServerMessage(message: string, field?: string): string {
  const byField = BY_FIELD[message]
  if (byField) return (field !== undefined && byField[field]) || 'Déjà utilisé'
  for (const [pattern, replacement] of TRANSLATIONS) {
    if (pattern.test(message)) return message.replace(pattern, replacement)
  }
  return message
}
```

- [ ] **Step 9 : Transmettre le champ (`src/lib/formErrors.ts`)**

Remplacer :

```ts
    form.setError(field.path as Path<T>, { type: 'server', message: translateServerMessage(field.message) })
```

par :

```ts
    form.setError(field.path as Path<T>, { type: 'server', message: translateServerMessage(field.message, field.path) })
```

et :

```ts
    ? others.map((other) => `${fieldLabel(other.field)} : ${translateServerMessage(other.message)}`).join(' · ')
```

par :

```ts
    ? others.map((other) => `${fieldLabel(other.field)} : ${translateServerMessage(other.message, other.field)}`).join(' · ')
```

- [ ] **Step 10 : `usernameRules` (`src/lib/validation.ts`)**

Ajouter après `emailRules` :

```ts
export const USERNAME_HINT = '3 à 30 caractères : lettres, chiffres, _ - .'

export const usernameRules = {
  validate: (value: string): true | string => {
    const username = value.trim()
    if (username === '') return 'Obligatoire'
    return /^[\p{L}\p{N}_.-]{3,30}$/u.test(username) || USERNAME_HINT
  },
}
```

- [ ] **Step 11 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Les tests de la page d'inscription peuvent encore attendre « Cet email est déjà utilisé » via l'ancien chemin : ils sont réécrits dans la Task 2. Si l'un d'eux échoue ici, vérifier que c'est uniquement le test 409 de `src/pages/auth.test.tsx`. Dans ce cas, ledger une ruling et le laisser à la Task 2.

- [ ] **Step 12 : Commit**

```bash
git add -A
git commit -m "feat: route 409/403 errors by field and detail, add username rules"
```

---

### Task 2 : Connexion et inscription par pseudo

**Files :**
- Modify : `src/api/types.ts`, `src/api/auth.ts`, `src/test/db.ts`, `src/test/handlers.ts`, `src/pages/LoginPage.tsx`, `src/pages/RegisterPage.tsx`
- Test : `src/api/endpoints.test.ts`, `src/pages/auth.test.tsx`, `src/pages/PatternFormPage.test.tsx` (ligne de connexion du test de brouillon)

**Interfaces :**
- Consumes : `usernameRules`, `translateServerMessage(message, field)` (Task 1).
- Produces :
  - `Account.username: string`
  - `interface LoginCredentials { username: string; password: string }`
  - `interface Registration { username: string; email: string; password: string }`
  - `login(c: LoginCredentials)`, `register(r: Registration)`
  - Tests : `seedAccount({ username?, email?, password?, loggedIn? })`, avec `username = 'ana'` par défaut.

- [ ] **Step 1 : Réécrire `src/pages/auth.test.tsx`**

```tsx
import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { apiUrl, problem } from '../test/handlers'
import { renderApp } from '../test/renderApp'
import { server } from '../test/server'

type User = ReturnType<typeof renderApp>['user']

async function logIn(user: User, username: string, password: string) {
  await user.type(await screen.findByLabelText('Pseudo'), username)
  await user.type(screen.getByLabelText('Mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Se connecter' }))
}

describe('LoginPage', () => {
  it('connecte par pseudo puis redirige vers redirect', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2Faccount')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mon compte' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/account')
  })

  it('accepte le pseudo dans une autre casse', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await logIn(user, 'ANA', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
  })

  it('affiche une erreur sur de mauvais identifiants', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/login')
    await logIn(user, 'ana', 'mauvais')
    expect(await screen.findByRole('alert')).toHaveTextContent('Pseudo ou mot de passe incorrect')
    expect(screen.getByRole('heading', { name: 'Connexion' })).toBeInTheDocument()
  })

  it('n’a plus de champ email', async () => {
    renderApp('/login')
    await screen.findByLabelText('Pseudo')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('affiche le délai d’attente en cas de 429', async () => {
    server.use(
      http.post(apiUrl('/api/auth/login'), () =>
        problem(429, 'Too many attempts, try again later', { headers: { 'Retry-After': '600' } }),
      ),
    )
    const { user } = renderApp('/login')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de tentatives, réessaie dans 10 min')
  })

  it('ne suit pas un redirect externe après connexion', async () => {
    seedAccount({ loggedIn: false })
    const { user, router } = renderApp('/login?redirect=%2F%5Cevil.example')
    await logIn(user, 'ana', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('RegisterPage', () => {
  async function fill(user: User, username: string, email: string, password: string, confirm = password) {
    await user.type(await screen.findByLabelText('Pseudo'), username)
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mot de passe'), password)
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), confirm)
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }))
  }

  it('crée le compte avec le pseudo saisi et arrive sur la liste', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'Éloïse', 'eloise@example.com', 'secret123')
    expect(await screen.findByRole('heading', { name: 'Mes patterns' })).toBeInTheDocument()
    expect(db.accounts[0]).toMatchObject({ username: 'Éloïse', email: 'eloise@example.com' })
  })

  it('affiche la 409 sous le pseudo et sous l’email', async () => {
    seedAccount({ loggedIn: false })
    const { user } = renderApp('/register')
    await fill(user, 'ANA', 'ana@example.com', 'secret123')
    expect(await screen.findByText('Ce pseudo est déjà pris')).toBeInTheDocument()
    expect(screen.getByText('Cet email est déjà utilisé')).toBeInTheDocument()
    expect(screen.getByLabelText('Pseudo')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('valide côté client sans appeler l’API', async () => {
    const { user } = renderApp('/register')
    await fill(user, 'a b', 'ana@example.com', 'court', 'autre')
    expect(await screen.findByText('3 à 30 caractères : lettres, chiffres, _ - .')).toBeInTheDocument()
    expect(screen.getByText('Au moins 8 caractères')).toBeInTheDocument()
    expect(screen.getByText('Les mots de passe ne correspondent pas')).toBeInTheDocument()
    expect(db.accounts).toHaveLength(0)
  })
})
```

- [ ] **Step 2 : Mettre à jour `src/api/endpoints.test.ts`**

Remplacer :

```ts
    const account = await register({ email: 'Ana@Example.com ', password: 'secret123' })
    expect(account.email).toBe('ana@example.com')
```

par :

```ts
    const account = await register({ username: 'Ana', email: 'Ana@Example.com ', password: 'secret123' })
    expect(account).toMatchObject({ username: 'Ana', email: 'ana@example.com' })
```

et :

```ts
    const error = await login({ email: 'ana@example.com', password: 'wrong' }).catch((e: unknown) => e)
```

par :

```ts
    const error = await login({ username: 'ana', password: 'wrong' }).catch((e: unknown) => e)
```

Ajouter dans `describe('auth')` :

```ts
  it('refuse un pseudo déjà pris, sans tenir compte de la casse', async () => {
    seedAccount({ loggedIn: false })
    const error = await register({ username: 'ANA', email: 'autre@example.com', password: 'secret123' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 409, fieldErrors: [{ field: 'username', message: 'is already used' }] })
  })
```

- [ ] **Step 3 : Dans `src/pages/PatternFormPage.test.tsx`**, test « propose de restaurer la saisie perdue… », remplacer :

```ts
    await user.type(await screen.findByLabelText('Email'), 'ana@example.com')
```

par :

```ts
    await user.type(await screen.findByLabelText('Pseudo'), 'ana')
```

- [ ] **Step 4 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/auth.test.tsx src/api/endpoints.test.ts`
Expected : FAIL, champ « Pseudo » introuvable et 409 sans `username`.

- [ ] **Step 5 : Types et endpoints**

`src/api/types.ts`, remplacer `Account` par :

```ts
export interface Account {
  id: number
  username: string
  email: string
  createdAt: string
}
```

`src/api/auth.ts`, remplacer `Credentials`, `register` et `login` par :

```ts
export interface LoginCredentials {
  username: string
  password: string
}

export interface Registration {
  username: string
  email: string
  password: string
}
```

```ts
export const register = (registration: Registration) =>
  api<Account>('/api/auth/register', { method: 'POST', body: registration })

export const login = (credentials: LoginCredentials) =>
  api<Account>('/api/auth/login', { method: 'POST', body: credentials })
```

- [ ] **Step 6 : Faux backend, comptes avec pseudo (`src/test/db.ts`)**

Remplacer `seedAccount` par :

```ts
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
```

- [ ] **Step 7 : Faux backend, register et login (`src/test/handlers.ts`)**

Ajouter après `const validation = …` :

```ts
const USERNAME = /^[\p{L}\p{N}_.-]{3,30}$/u
const USERNAME_MESSAGE = "must be 3 to 30 letters, digits, '_', '-' or '.'"
const sameUsername = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()
```

Remplacer `publicAccount` par :

```ts
const publicAccount = ({ id, username, email, createdAt }: DbAccount) => ({ id, username, email, createdAt })
```

Remplacer le handler `register` par :

```ts
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
```

Remplacer le handler `login` par :

```ts
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
```

- [ ] **Step 8 : Page de connexion (`src/pages/LoginPage.tsx`)**

Remplacer `interface LoginValues` et les valeurs par défaut :

```tsx
interface LoginValues {
  username: string
  password: string
}
```

```tsx
  const form = useForm<LoginValues>({ defaultValues: { username: '', password: '' } })
```

Remplacer l'appel de mutation :

```tsx
      await loginMutation.mutateAsync({ username: values.username.trim(), password: values.password })
```

Remplacer le champ Email par :

```tsx
        <TextField
          label="Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          error={errors.username?.message}
          {...register('username', { validate: requiredText })}
        />
```

- [ ] **Step 9 : Page d'inscription (`src/pages/RegisterPage.tsx`)**

Remplacer le fichier par :

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation } from 'react-router'
import { useRegister } from '../api/queries'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/Button'
import { FormBanner } from '../components/FormBanner'
import { TextField } from '../components/TextField'
import { applyServerErrors } from '../lib/formErrors'
import { confirmRule, emailRules, newPasswordRules, USERNAME_HINT, usernameRules } from '../lib/validation'

interface RegisterValues {
  username: string
  email: string
  password: string
  confirm: string
}

export function RegisterPage() {
  const form = useForm<RegisterValues>({ defaultValues: { username: '', email: '', password: '', confirm: '' } })
  const { register, handleSubmit, getValues, formState: { errors } } = form
  const registerMutation = useRegister()
  const location = useLocation()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null)
    try {
      await registerMutation.mutateAsync({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      })
    } catch (error) {
      // 409 : le serveur nomme le champ pris (pseudo et/ou email), mappé sous le bon champ.
      setBanner(applyServerErrors(error, form))
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
          label="Pseudo"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          hint={USERNAME_HINT}
          error={errors.username?.message}
          {...register('username', usernameRules)}
        />
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

- [ ] **Step 10 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS (toute la suite).

- [ ] **Step 11 : Commit**

```bash
git add -A
git commit -m "feat: log in and register with a username"
```

---

### Task 3 : Visibilité, avancement par compte et catalogue (couche API)

**Files :**
- Modify : `src/api/types.ts`, `src/api/patterns.ts`, `src/api/queries.ts`, `src/test/db.ts`, `src/test/handlers.ts`
- Test : `src/api/endpoints.test.ts`

**Interfaces :**
- Produces :
  - `type Visibility = 'PRIVATE' | 'PUBLIC'`, `interface Author { username: string }`
  - `Pattern` et `PatternSummary` : `visibility: Visibility; author: Author; mine: boolean`
  - `PatternInput.visibility?: Visibility`
  - `listPublicPatterns(): Promise<PatternSummary[]>`
  - `queryKeys.publicPatterns = ['patterns', 'public']`, `usePublicPatterns()`
  - Tests :
    - `DbPattern.progress` est l'avancement **de l'auteur**, `DbPattern.otherProgress: Record<number, Progress>` celui des autres comptes ;
    - `seedProgress(pattern, accountId, progress)` ;
    - `seedPattern(ownerId, { visibility })`, avec `PRIVATE` par défaut.

- [ ] **Step 1 : Écrire les tests (`src/api/endpoints.test.ts`)**

Remplacer l'import de `../test/db` et de `./patterns` par :

```ts
import { db, progressAt, seedAccount, seedPattern, seedProgress } from '../test/db'
```

```ts
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
```

Ajouter à la fin du fichier :

```ts
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
    const updated = await createPattern({ title: 'Neuf', steps: mine.steps })
    expect(updated.visibility).toBe('PRIVATE')
    expect((await updatePattern(mine.id, { title: mine.title, steps: mine.steps })).visibility).toBe('PRIVATE')
  })
})
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/api/endpoints.test.ts`
Expected : FAIL, `listPublicPatterns` et `seedProgress` introuvables.

- [ ] **Step 3 : Types (`src/api/types.ts`)**

Ajouter après `ProgressStatus` :

```ts
export type Visibility = 'PRIVATE' | 'PUBLIC'

export interface Author {
  username: string
}
```

Ajouter dans `Pattern` **et** dans `PatternSummary`, après `progress` :

```ts
  visibility: Visibility
  author: Author
  /** Je suis l'auteur : édition et suppression possibles. */
  mine: boolean
```

Ajouter dans `PatternInput`, après `imageUrl?` :

```ts
  visibility?: Visibility
```

- [ ] **Step 4 : Endpoint (`src/api/patterns.ts`)**

Ajouter après `listPatterns` :

```ts
export const listPublicPatterns = () => api<PatternSummary[]>('/api/patterns/public')
```

- [ ] **Step 5 : Base du faux backend (`src/test/db.ts`)**

Remplacer `DbPattern` par :

```ts
/** `progress` est l'avancement de l'auteur ; celui des autres comptes est dans `otherProgress`. */
export interface DbPattern extends Omit<Pattern, 'author' | 'mine'> {
  ownerId: number
  otherProgress: Record<number, Progress>
}
```

Remplacer `seedPattern` par :

```ts
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
```

- [ ] **Step 6 : Handlers du faux backend (`src/test/handlers.ts`)**

Remplacer l'import des types par :

```ts
import type { ApiFieldError, Pattern, PatternInput, PatternSummary, Progress, ProgressInput } from '../api/types'
```

Remplacer `publicPattern`, `toSummary`, `findOwned` et `notFound` par :

```ts
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
```

Dans `validatePatternInput`, ajouter en tête :

```ts
  if (input.visibility !== undefined && input.visibility !== 'PRIVATE' && input.visibility !== 'PUBLIC') {
    errors.push({ field: 'visibility', message: 'must be one of [PRIVATE, PUBLIC]' })
  }
```

(`const errors` doit être déclarée avant ce bloc.)

Remplacer `applyInput` par :

```ts
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
```

Remplacer **tous les handlers `/api/patterns…`** (de `http.get(apiUrl('/api/patterns'), …` jusqu'à la fin du tableau) par :

```ts
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
```

- [ ] **Step 7 : Cache (`src/api/queries.ts`)**

Remplacer les deux premières lignes d'import par :

```ts
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
```

Ajouter `listPublicPatterns` à l'import de `./patterns`.

Remplacer `queryKeys` par :

```ts
export const queryKeys = {
  csrf: ['csrf'] as const,
  me: ['me'] as const,
  patterns: ['patterns'] as const,
  publicPatterns: ['patterns', 'public'] as const,
  pattern: (id: number) => ['patterns', id] as const,
}

/** Les deux listes (mes patterns, catalogue) dépendent de toute écriture. */
function invalidateLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true }),
    queryClient.invalidateQueries({ queryKey: queryKeys.publicPatterns, exact: true }),
  ])
}
```

Ajouter après `usePatterns` :

```ts
export function usePublicPatterns() {
  return useQuery({ queryKey: queryKeys.publicPatterns, queryFn: listPublicPatterns })
}
```

Remplacer chaque `queryClient.invalidateQueries({ queryKey: queryKeys.patterns, exact: true })` par `invalidateLists(queryClient)`. Cela concerne `useUpdateProgress` (`onSettled`), `useAbandonProgress` (`onSettled`), `useDeletePattern` et `useSavePattern`. Garder `await` ou `void` tels quels.

Dans `useDeletePattern`, `onSuccess`, ajouter après le filtre existant de la liste :

```ts
      queryClient.setQueryData<PatternSummary[]>(queryKeys.publicPatterns, (list) => list?.filter((p) => p.id !== patternId))
```

- [ ] **Step 8 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS sur toute la suite. Les tests existants restent valides, puisque `DbPattern.progress` reste l'avancement de l'auteur.

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat: add visibility, per-account progress and public catalogue to the API layer"
```

---

### Task 4 : Accueil à onglets (Mes patterns / Catalogue)

**Files :**
- Create : `src/lib/patternLists.ts`, `src/components/VisibilityBadge.tsx`
- Modify : `src/pages/PatternListPage.tsx`, `src/pages/patternList/PatternCard.tsx`
- Test : `src/lib/patternLists.test.ts`, `src/pages/PatternListPage.test.tsx`

**Interfaces :**
- Consumes : `usePatterns`, `usePublicPatterns` (Task 3), types (Task 3).
- Produces :
  - `mergeMyPatterns(mine: PatternSummary[], publics: PatternSummary[]): PatternSummary[]`
  - `VisibilityBadge({ visibility }: { visibility: Visibility })`

- [ ] **Step 1 : Tests de la fusion (`src/lib/patternLists.test.ts`)**

```ts
import { expect, it } from 'vitest'
import type { PatternSummary, Progress } from '../api/types'
import { mergeMyPatterns } from './patternLists'

const progress: Progress = {
  status: 'IN_PROGRESS',
  stepIndex: 0,
  rowIndex: 0,
  startedAt: '2026-10-12T12:00:00Z',
  updatedAt: '2026-10-12T12:00:00Z',
  finishedAt: null,
}

const summary = (id: number, title: string, extra: Partial<PatternSummary> = {}): PatternSummary => ({
  id,
  title,
  description: null,
  hookSizeMm: null,
  yarn: null,
  imageUrl: null,
  stepCount: 1,
  progress: null,
  visibility: 'PRIVATE',
  author: { username: 'ana' },
  mine: true,
  ...extra,
})

it('ajoute les patterns publics des autres que j’ai commencés, sans doublon, triés par titre', () => {
  const mine = [summary(1, 'zèbre'), summary(2, 'Abeille', { visibility: 'PUBLIC' })]
  const publics = [
    summary(2, 'Abeille', { visibility: 'PUBLIC' }),
    summary(3, 'Écureuil', { visibility: 'PUBLIC', mine: false, author: { username: 'bob' }, progress }),
    summary(4, 'Chat', { visibility: 'PUBLIC', mine: false, author: { username: 'bob' } }),
  ]
  expect(mergeMyPatterns(mine, publics).map((p) => p.id)).toEqual([2, 3, 1])
})

it('renvoie mes patterns quand le catalogue est vide', () => {
  expect(mergeMyPatterns([summary(1, 'Lapin')], [])).toHaveLength(1)
})
```

- [ ] **Step 2 : Tests de la page (`src/pages/PatternListPage.test.tsx`)**

Remplacer l'import de `../test/db` par :

```ts
import { db, progressAt, seedAccount, seedPattern, seedProgress } from '../test/db'
```

Ajouter à la fin du fichier :

```tsx
describe('onglets', () => {
  function seedCatalogue() {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    const ana = seedAccount()
    seedPattern(ana.id, { title: 'Abeille', visibility: 'PUBLIC' })
    seedPattern(ana.id, { title: 'Lapin' })
    const ours = seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC' })
    seedPattern(bob.id, { title: 'Chat', visibility: 'PUBLIC' })
    seedPattern(bob.id, { title: 'Secret' })
    seedProgress(ours, ana.id, progressAt(0, 1))
    return { ana, bob, ours }
  }

  const titles = () => screen.getAllByRole('listitem').map((item) => within(item).getByRole('heading').textContent)

  it('Mes patterns inclut les patterns publics des autres que j’ai commencés', async () => {
    seedCatalogue()
    renderApp('/')
    await screen.findAllByRole('listitem')
    expect(titles()).toEqual(['Abeille', 'Lapin', 'Ours'])
    expect(screen.getByText('par bob')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Mes patterns' })).toHaveAttribute('aria-selected', 'true')
  })

  it('le catalogue liste tous les patterns publics, et l’onglet est dans l’URL', async () => {
    seedCatalogue()
    const { user, router } = renderApp('/')
    await user.click(await screen.findByRole('tab', { name: 'Catalogue' }))
    await waitFor(() => expect(titles()).toEqual(['Abeille', 'Chat', 'Ours']))
    expect(router.state.location.search).toBe('?onglet=catalogue')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.queryByRole('link', { name: 'Nouveau pattern' })).not.toBeInTheDocument()
  })

  it('ouvre directement le catalogue depuis l’URL', async () => {
    seedCatalogue()
    renderApp('/?onglet=catalogue')
    expect(await screen.findByRole('tab', { name: 'Catalogue' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('heading', { name: 'Chat' })).toBeInTheDocument()
  })

  it('affiche un état vide dans le catalogue', async () => {
    seedAccount()
    renderApp('/?onglet=catalogue')
    expect(await screen.findByText('Aucun pattern public pour l’instant.')).toBeInTheDocument()
  })

  it('retire un pattern repassé en privé par son auteur au rechargement', async () => {
    const { ours } = seedCatalogue()
    const { queryClient } = renderApp('/')
    expect(await screen.findByRole('heading', { name: 'Ours' })).toBeInTheDocument()
    ours.visibility = 'PRIVATE'
    ours.otherProgress = {}
    await queryClient.invalidateQueries()
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Ours' })).not.toBeInTheDocument())
    expect(db.patterns).toHaveLength(5)
  })
})
```

Ajouter `waitFor` à l'import de `@testing-library/react` :

```ts
import { screen, waitFor, within } from '@testing-library/react'
```

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/lib/patternLists.test.ts src/pages/PatternListPage.test.tsx`
Expected : FAIL, `./patternLists` introuvable et onglets absents.

- [ ] **Step 4 : `src/lib/patternLists.ts`**

```ts
import type { PatternSummary } from '../api/types'

/**
 * « Mes patterns » : les miens, plus les patterns publics des autres que j'ai commencés
 * (aucun endpoint ne les renvoie ensemble). Dédoublonné par id, trié par titre.
 */
export function mergeMyPatterns(mine: PatternSummary[], publics: PatternSummary[]): PatternSummary[] {
  const byId = new Map(mine.map((pattern) => [pattern.id, pattern]))
  for (const pattern of publics) {
    if (!pattern.mine && pattern.progress !== null && !byId.has(pattern.id)) byId.set(pattern.id, pattern)
  }
  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
}
```

- [ ] **Step 5 : `src/components/VisibilityBadge.tsx`**

```tsx
import type { Visibility } from '../api/types'

const STYLES: Record<Visibility, string> = {
  PUBLIC: 'bg-sky-100 text-sky-900',
  PRIVATE: 'bg-stone-100 text-stone-700',
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[visibility]}`}>
      {visibility === 'PUBLIC' ? 'Public' : 'Privé'}
    </span>
  )
}
```

- [ ] **Step 6 : Carte (`src/pages/patternList/PatternCard.tsx`)**

Ajouter l'import :

```tsx
import { VisibilityBadge } from '../../components/VisibilityBadge'
```

Remplacer le bloc qui suit le titre `<h2 …>{pattern.title}</h2>` :

```tsx
        {meta && <p className="truncate text-sm text-stone-500">{meta}</p>}
        <div>
          <StatusBadge progress={pattern.progress} stepCount={pattern.stepCount} />
        </div>
```

par :

```tsx
        {!pattern.mine && <p className="truncate text-sm text-stone-500">par {pattern.author.username}</p>}
        {meta && <p className="truncate text-sm text-stone-500">{meta}</p>}
        <div className="flex flex-wrap gap-1">
          <StatusBadge progress={pattern.progress} stepCount={pattern.stepCount} />
          {pattern.mine && pattern.visibility === 'PUBLIC' && <VisibilityBadge visibility="PUBLIC" />}
        </div>
```

- [ ] **Step 7 : Page (`src/pages/PatternListPage.tsx`)**

Remplacer le fichier par :

```tsx
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { usePatterns, usePublicPatterns } from '../api/queries'
import { ErrorState } from '../components/ErrorState'
import { Skeleton } from '../components/Skeleton'
import { mergeMyPatterns } from '../lib/patternLists'
import { patternState, type PatternState } from '../lib/progress'
import { PatternCard } from './patternList/PatternCard'

type Filter = 'all' | PatternState
type Tab = 'mine' | 'catalogue'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'in-progress', label: 'En cours' },
  { value: 'finished', label: 'Terminés' },
  { value: 'not-started', label: 'Non commencés' },
]

const TABS: { value: Tab; label: string }[] = [
  { value: 'mine', label: 'Mes patterns' },
  { value: 'catalogue', label: 'Catalogue' },
]

export function PatternListPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('onglet') === 'catalogue' ? 'catalogue' : 'mine'
  const mine = usePatterns()
  const publics = usePublicPatterns()
  const [filter, setFilter] = useState<Filter>('all')

  const queries = tab === 'catalogue' ? [publics] : [mine, publics]
  const isPending = queries.some((query) => query.isPending)
  const failed = queries.find((query) => query.isError)
  const data =
    tab === 'catalogue' ? publics.data : mine.data && publics.data ? mergeMyPatterns(mine.data, publics.data) : undefined
  const visible = (data ?? []).filter((pattern) => filter === 'all' || patternState(pattern.progress) === filter)

  const selectTab = (next: Tab) => {
    // Remplace l'entrée : Retour quitte la page au lieu de rejouer les changements d'onglet.
    setParams(next === 'catalogue' ? { onglet: 'catalogue' } : {}, { replace: true })
    setFilter('all')
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{tab === 'catalogue' ? 'Catalogue public' : 'Mes patterns'}</h1>

      <div role="tablist" aria-label="Listes de patterns" className="grid grid-cols-2 rounded-xl bg-stone-200 p-1">
        {TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => selectTab(value)}
            className={`min-h-11 rounded-lg text-sm font-medium ${tab === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {isPending && (
        <div className="flex flex-col gap-3">
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      )}

      {!isPending && failed && <ErrorState error={failed.error} onRetry={() => queries.forEach((query) => void query.refetch())} />}

      {!isPending && !failed && data && data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          {tab === 'catalogue' ? (
            <p className="text-stone-600">Aucun pattern public pour l’instant.</p>
          ) : (
            <>
              <p className="text-stone-600">Aucun pattern pour l’instant.</p>
              <Link to="/patterns/new" className="rounded-xl bg-rose-600 px-4 py-3 font-medium text-white">
                Créer mon premier pattern
              </Link>
            </>
          )}
        </div>
      )}

      {!isPending && !failed && data && data.length > 0 && (
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

      {tab === 'mine' && (
        <Link
          to="/patterns/new"
          aria-label="Nouveau pattern"
          className="fixed right-5 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-rose-600 text-3xl text-white shadow-lg active:bg-rose-700"
        >
          +
        </Link>
      )}
    </div>
  )
}
```

- [ ] **Step 8 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Le test existant `'renvoie au login sur une 401'` passe toujours : la 401 sur `/api/patterns` suffit à vider `me`.

- [ ] **Step 9 : Commit**

```bash
git add -A
git commit -m "feat: add My patterns / Catalogue tabs with authors and public badges"
```

---

### Task 5 : Détail, auteur et actions réservées à l'auteur

**Files :**
- Modify : `src/pages/patternDetail/PatternInfo.tsx`, `src/pages/patternDetail/PatternMenu.tsx`, `src/pages/patternDetail/PatternDetail.tsx`
- Test : `src/pages/PatternDetailPublic.test.tsx`

**Interfaces :**
- Consumes : `Pattern.mine`, `author` et `visibility` (Task 3), `VisibilityBadge` (Task 4), `seedProgress` (Task 3).

- [ ] **Step 1 : Écrire les tests (`src/pages/PatternDetailPublic.test.tsx`)**

```tsx
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern } from '../test/db'
import { renderApp } from '../test/renderApp'

function seedOthersPublic() {
  const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
  const ana = seedAccount()
  const ours = seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC', progress: progressAt(1, 0) })
  return { ana, bob, ours }
}

describe('détail selon l’auteur', () => {
  it('affiche l’auteur et masque Modifier/Supprimer sur le pattern d’un autre', async () => {
    const { ours } = seedOthersPublic()
    const { user } = renderApp(`/patterns/${ours.id}`)
    expect(await screen.findByText('par bob')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions du pattern' }))
    expect(screen.queryByRole('menuitem', { name: 'Modifier' })).not.toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Supprimer le pattern' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Écran toujours allumé' })).toBeInTheDocument()
  })

  it('permet de suivre son propre avancement sur le pattern public d’un autre', async () => {
    const { ana, ours } = seedOthersPublic()
    const { user } = renderApp(`/patterns/${ours.id}`)
    await user.click(await screen.findByRole('button', { name: 'Démarrer' }))
    await waitFor(() => expect(db.patterns[0].otherProgress[ana.id]).toMatchObject({ stepIndex: 0, rowIndex: 0 }))
    expect(db.patterns[0].progress).toMatchObject({ stepIndex: 1, rowIndex: 0 })
  })

  it('affiche Public et la mention des autres comptes à la suppression de mon pattern public', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    const { user } = renderApp(`/patterns/${lapin.id}`)
    expect(await screen.findByText('Public')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actions du pattern' }))
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le pattern' }))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Le pattern, ton avancement et celui des autres comptes seront définitivement supprimés.',
    )
  })

  it('affiche Privé sur mon pattern privé, sans auteur', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id)
    renderApp(`/patterns/${lapin.id}`)
    expect(await screen.findByText('Privé')).toBeInTheDocument()
    expect(screen.queryByText(/^par /)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/PatternDetailPublic.test.tsx`
Expected : FAIL, « par bob », « Public » et « Privé » sont absents, et Modifier est présent.

- [ ] **Step 3 : Auteur et badge (`src/pages/patternDetail/PatternInfo.tsx`)**

Ajouter l'import :

```tsx
import { VisibilityBadge } from '../../components/VisibilityBadge'
```

Ajouter en premier enfant de `<section className="flex flex-col gap-3">` :

```tsx
      {pattern.mine ? (
        <div>
          <VisibilityBadge visibility={pattern.visibility} />
        </div>
      ) : (
        <p className="text-sm text-stone-500">par {pattern.author.username}</p>
      )}
```

- [ ] **Step 4 : Menu (`src/pages/patternDetail/PatternMenu.tsx`)**

Remplacer le lien Modifier :

```tsx
            <Link role="menuitem" to={`/patterns/${pattern.id}/edit`} state={{ fromDetail: true }} className={ITEM}>
              Modifier
            </Link>
```

par :

```tsx
            {pattern.mine && (
              <Link role="menuitem" to={`/patterns/${pattern.id}/edit`} state={{ fromDetail: true }} className={ITEM}>
                Modifier
              </Link>
            )}
```

et le bouton de suppression :

```tsx
            <button role="menuitem" type="button" className={`${ITEM} text-red-700`} onClick={run(onDelete)}>
              Supprimer le pattern
            </button>
```

par :

```tsx
            {pattern.mine && (
              <button role="menuitem" type="button" className={`${ITEM} text-red-700`} onClick={run(onDelete)}>
                Supprimer le pattern
              </button>
            )}
```

- [ ] **Step 5 : Message de suppression (`src/pages/patternDetail/PatternDetail.tsx`)**

Remplacer :

```tsx
        message="Le pattern et son avancement seront définitivement supprimés."
```

par :

```tsx
        message={
          pattern.visibility === 'PUBLIC'
            ? 'Le pattern, ton avancement et celui des autres comptes seront définitivement supprimés.'
            : 'Le pattern et son avancement seront définitivement supprimés.'
        }
```

- [ ] **Step 6 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS.

- [ ] **Step 7 : Commit**

```bash
git add -A
git commit -m "feat: show pattern author and restrict edit/delete to the author"
```

---

### Task 6 : Visibilité dans le formulaire

**Files :**
- Modify : `src/pages/patternForm/formModel.ts`, `src/pages/patternForm/PatternForm.tsx`, `src/pages/PatternFormPage.tsx`
- Test : `src/pages/patternForm/formModel.test.ts`, `src/pages/PatternFormVisibility.test.tsx`

**Interfaces :**
- Consumes : `Visibility` (Task 3), message 403 (Task 1), `seedProgress` (Task 3).
- Produces : `PatternFormValues.visibility: Visibility`. `toPatternInput` renvoie toujours `visibility`.

- [ ] **Step 1 : Adapter les tests du modèle (`src/pages/patternForm/formModel.test.ts`)**

Dans le premier test, ajouter dans l'objet attendu par `toEqual` :

```ts
      visibility: 'PRIVATE',
```

Dans le second test, remplacer l'objet `pattern` par :

```ts
    const pattern = {
      id: 1, title: 'Lapin', description: null, hookSizeMm: 3.5, yarn: 'Coton', sourceUrl: null, imageUrl: null,
      createdAt: '', updatedAt: '', progress: null, visibility: 'PUBLIC', author: { username: 'ana' }, mine: true,
      steps: [{ title: 'Tête', rows: [{ number: '1', value: '6ms' }] }],
    } satisfies Pattern
    expect(toFormValues(pattern)).toMatchObject({
      description: '', hookSizeMm: '3,5', yarn: 'Coton', sourceUrl: '', visibility: 'PUBLIC',
    })
```

- [ ] **Step 2 : Tests de la page (`src/pages/PatternFormVisibility.test.tsx`)**

```tsx
import { screen } from '@testing-library/react'
import { http } from 'msw'
import { describe, expect, it } from 'vitest'
import { db, progressAt, seedAccount, seedPattern, seedProgress } from '../test/db'
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

describe('visibilité', () => {
  it('crée en privé par défaut', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    expect(screen.getByRole('radio', { name: /^Privé/ })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].visibility).toBe('PRIVATE')
  })

  it('crée en public si on le choisit', async () => {
    seedAccount()
    const { user } = renderApp('/patterns/new')
    await fillMinimal(user)
    await user.click(screen.getByRole('radio', { name: /^Public/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByRole('heading', { name: 'Lapin' })
    expect(db.patterns[0].visibility).toBe('PUBLIC')
  })

  it('garde un pattern public en public quand on l’édite sans toucher à la visibilité', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)
    const title = await screen.findByLabelText('Titre *')
    await user.type(title, ' bleu')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('heading', { name: 'Lapin bleu' })).toBeInTheDocument()
    expect(db.patterns[0].visibility).toBe('PUBLIC')
  })

  it('demande confirmation avant de repasser en privé, et Annuler n’envoie rien', async () => {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    const ana = seedAccount()
    const lapin = seedPattern(ana.id, { visibility: 'PUBLIC' })
    seedProgress(lapin, bob.id, progressAt(0, 0))
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)

    await user.click(await screen.findByRole('radio', { name: /^Privé/ }))
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(screen.getByRole('alertdialog', { name: 'Rendre ce pattern privé ?' })).toHaveTextContent(
      'Les autres comptes perdront l’accès à ce pattern et leur avancement.',
    )
    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(db.patterns[0].visibility).toBe('PUBLIC')
    expect(screen.getByLabelText('Titre *')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await user.click(screen.getByRole('button', { name: 'Rendre privé' }))
    expect(await screen.findByRole('heading', { name: 'Lapin' })).toBeInTheDocument()
    expect(db.patterns[0].visibility).toBe('PRIVATE')
    expect(db.patterns[0].otherProgress).toEqual({})
  })

  it('refuse d’ouvrir le formulaire sur le pattern d’un autre', async () => {
    const bob = seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    seedAccount()
    const ours = seedPattern(bob.id, { title: 'Ours', visibility: 'PUBLIC' })
    renderApp(`/patterns/${ours.id}/edit`)
    expect(await screen.findByRole('heading', { name: 'Seul l’auteur peut modifier ce pattern' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Retour au pattern' })).toHaveAttribute('href', `/patterns/${ours.id}`)
    expect(screen.queryByLabelText('Titre *')).not.toBeInTheDocument()
  })

  it('affiche la 403 « autre compte » dans le bandeau, sans nouvel essai CSRF', async () => {
    const ana = seedAccount()
    const lapin = seedPattern(ana.id)
    let csrfCalls = 0
    server.use(
      http.get(apiUrl('/api/auth/csrf'), () => {
        csrfCalls += 1
      }),
      http.put(apiUrl(`/api/patterns/${lapin.id}`), () => problem(403, `Pattern ${lapin.id} belongs to another account`)),
    )
    const { user } = renderApp(`/patterns/${lapin.id}/edit`)
    await screen.findByLabelText('Titre *')
    const callsAfterBoot = csrfCalls
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pattern appartient à un autre compte')
    expect(csrfCalls).toBe(callsAfterBoot)
  })
})
```

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/patternForm/formModel.test.ts src/pages/PatternFormVisibility.test.tsx`
Expected : FAIL, `visibility` absent du modèle et radios introuvables.

- [ ] **Step 4 : Modèle (`src/pages/patternForm/formModel.ts`)**

Remplacer l'import par :

```ts
import type { Pattern, PatternInput, Visibility } from '../../api/types'
```

Ajouter dans `PatternFormValues`, après `imageUrl: string` :

```ts
  visibility: Visibility
```

Dans `emptyForm`, ajouter après `imageUrl: '',` :

```ts
  visibility: 'PRIVATE',
```

Dans `toFormValues`, ajouter après `imageUrl: pattern.imageUrl ?? '',` :

```ts
    visibility: pattern.visibility,
```

Dans `toPatternInput`, ajouter après `imageUrl: optional(values.imageUrl),` :

```ts
    // Toujours envoyée : omise, l'API repasserait le pattern en privé.
    visibility: values.visibility,
```

- [ ] **Step 5 : Formulaire (`src/pages/patternForm/PatternForm.tsx`)**

Ajouter l'état de confirmation après `const saved = useRef(false)` :

```tsx
  const [confirmPrivate, setConfirmPrivate] = useState<PatternFormValues | null>(null)
```

Remplacer `const onSubmit = handleSubmit(…)` (tout le bloc) par :

```tsx
  const persist = async (values: PatternFormValues) => {
    setBanner(null)
    try {
      const result = await save.mutateAsync(toPatternInput(values))
      saved.current = true
      clearDraft(pattern?.id)
      // Ouvert depuis le détail : on y revient sans empiler une seconde entrée d'historique.
      if (pattern && (location.state as { fromDetail?: boolean } | null)?.fromDetail) navigate(-1)
      else navigate(`/patterns/${result.id}`, { replace: true })
    } catch (error) {
      // Session expirée : la redirection vers le login va suivre, on garde la saisie.
      if (error instanceof ApiError && error.status === 401) saveDraft(pattern?.id, values)
      setBanner(applyServerErrors(error, form))
    }
  }

  const onSubmit = handleSubmit(
    async (values) => {
      // Public → privé coupe l'accès des autres comptes : on confirme d'abord.
      if (pattern?.visibility === 'PUBLIC' && values.visibility === 'PRIVATE') {
        setConfirmPrivate(values)
        return
      }
      await persist(values)
    },
    () => scheduleFocusFirstError(form),
  )
```

Ajouter, juste avant `</section>` qui ferme la section des champs généraux (après le bloc `URL image`) :

```tsx
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-stone-700">Visibilité</legend>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-stone-300 has-checked:ring-2 has-checked:ring-rose-500">
            <input type="radio" value="PRIVATE" className="size-5 accent-rose-600" {...register('visibility')} />
            Privé — visible par moi seul
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-stone-300 has-checked:ring-2 has-checked:ring-rose-500">
            <input type="radio" value="PUBLIC" className="size-5 accent-rose-600" {...register('visibility')} />
            Public — lisible par tous les comptes connectés
          </label>
        </fieldset>
```

Ajouter, après le `ConfirmDialog` du blocker :

```tsx
      <ConfirmDialog
        open={confirmPrivate !== null}
        title="Rendre ce pattern privé ?"
        message="Les autres comptes perdront l’accès à ce pattern et leur avancement."
        confirmLabel="Rendre privé"
        danger
        loading={save.isPending}
        onCancel={() => setConfirmPrivate(null)}
        onConfirm={() => {
          const values = confirmPrivate
          setConfirmPrivate(null)
          if (values) void persist(values)
        }}
      />
```

- [ ] **Step 6 : Refus pour un non-auteur (`src/pages/PatternFormPage.tsx`)**

Ajouter `Link` à l'import de `react-router` :

```tsx
import { Link, useParams } from 'react-router'
```

Remplacer la dernière ligne de `EditPattern` :

```tsx
  return <PatternForm key={query.data.id} pattern={query.data} />
```

par :

```tsx
  if (!query.data.mine) return <NotAuthor patternId={query.data.id} />
  return <PatternForm key={query.data.id} pattern={query.data} />
```

et ajouter à la fin du fichier :

```tsx
function NotAuthor({ patternId }: { patternId: number }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Seul l’auteur peut modifier ce pattern</h1>
      <Link to={`/patterns/${patternId}`} className="font-medium text-rose-700 underline">
        Retour au pattern
      </Link>
    </div>
  )
}
```

- [ ] **Step 7 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Si Tailwind ne génère pas `has-checked:`, la page reste fonctionnelle (seul l'anneau de sélection manque). Le remplacer alors par `has-[:checked]:ring-2 has-[:checked]:ring-rose-500`.

- [ ] **Step 8 : Commit**

```bash
git add -A
git commit -m "feat: choose pattern visibility, confirm going private, block non-author edits"
```

---

### Task 7 : Changement de pseudo, pseudo affiché et validation finale

**Files :**
- Create : `src/pages/account/ChangeUsernameForm.tsx`
- Modify : `src/api/auth.ts`, `src/api/queries.ts`, `src/test/handlers.ts`, `src/pages/AccountPage.tsx`, `src/components/Layout.tsx`
- Test : `src/pages/AccountUsername.test.tsx`

**Interfaces :**
- Consumes : `usernameRules`, `USERNAME_HINT` (Task 1), `Account.username` (Task 2).
- Produces : `changeUsername(body: { username: string; currentPassword: string }): Promise<Account>`, `useChangeUsername()`.

- [ ] **Step 1 : Écrire les tests (`src/pages/AccountUsername.test.tsx`)**

```tsx
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db, seedAccount } from '../test/db'
import { renderApp } from '../test/renderApp'

type User = ReturnType<typeof renderApp>['user']

async function changeUsername(user: User, username: string, password: string) {
  await user.type(await screen.findByLabelText('Nouveau pseudo'), username)
  await user.type(screen.getByLabelText('Confirme avec ton mot de passe'), password)
  await user.click(screen.getByRole('button', { name: 'Changer de pseudo' }))
}

describe('pseudo', () => {
  it('affiche le pseudo dans le compte et dans la barre du haut', async () => {
    seedAccount()
    renderApp('/account')
    expect(await screen.findByText('@ana')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compte (@ana)' })).toHaveAttribute('href', '/account')
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('change le pseudo et met à jour l’affichage', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'ana_crochet', 'secret123')
    expect(await screen.findByText('Pseudo modifié')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compte (@ana_crochet)' })).toBeInTheDocument()
    expect(db.accounts[0].username).toBe('ana_crochet')
    expect(screen.getByLabelText('Nouveau pseudo')).toHaveValue('')
  })

  it('signale un pseudo déjà pris sous le champ', async () => {
    seedAccount({ username: 'bob', email: 'bob@example.com', loggedIn: false })
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'BOB', 'secret123')
    await waitFor(() => expect(screen.getByLabelText('Nouveau pseudo')).toHaveAccessibleDescription('Ce pseudo est déjà pris'))
  })

  it('signale un mot de passe incorrect sous le champ', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'ana_crochet', 'mauvais')
    await waitFor(() =>
      expect(screen.getByLabelText('Confirme avec ton mot de passe')).toHaveAccessibleDescription('Mot de passe incorrect'),
    )
    expect(db.accounts[0].username).toBe('ana')
  })

  it('valide le pseudo côté client', async () => {
    seedAccount()
    const { user } = renderApp('/account')
    await changeUsername(user, 'a b', 'secret123')
    expect(await screen.findByText('3 à 30 caractères : lettres, chiffres, _ - .')).toBeInTheDocument()
    expect(db.accounts[0].username).toBe('ana')
  })
})
```

- [ ] **Step 2 : Lancer les tests et vérifier qu'ils échouent**

Run : `npx vitest run src/pages/AccountUsername.test.tsx`
Expected : FAIL, « @ana » et le formulaire de pseudo sont absents.

- [ ] **Step 3 : Endpoint (`src/api/auth.ts`)**

Ajouter après `changePassword` :

```ts
export const changeUsername = (body: { username: string; currentPassword: string }) =>
  api<Account>('/api/me/username', { method: 'PUT', body })
```

- [ ] **Step 4 : Faux backend (`src/test/handlers.ts`)**

Ajouter après le handler `PUT /api/me/password` :

```ts
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
```

- [ ] **Step 5 : Mutation (`src/api/queries.ts`)**

Ajouter `changeUsername` à l'import de `./auth`, puis ajouter à la fin du fichier :

```ts
export function useChangeUsername() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: changeUsername,
    onSuccess: (account) => queryClient.setQueryData(queryKeys.me, account),
  })
}
```

- [ ] **Step 6 : Formulaire (`src/pages/account/ChangeUsernameForm.tsx`)**

```tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useChangeUsername } from '../../api/queries'
import { Button } from '../../components/Button'
import { FormBanner } from '../../components/FormBanner'
import { TextField } from '../../components/TextField'
import { useToast } from '../../components/toast/useToast'
import { applyServerErrors } from '../../lib/formErrors'
import { USERNAME_HINT, usernameRules } from '../../lib/validation'

interface Values {
  username: string
  currentPassword: string
}

export function ChangeUsernameForm() {
  const form = useForm<Values>({ defaultValues: { username: '', currentPassword: '' } })
  const { register, handleSubmit, reset, formState: { errors } } = form
  const mutation = useChangeUsername()
  const toast = useToast()
  const [banner, setBanner] = useState<string | null>(null)

  const onSubmit = handleSubmit(async ({ username, currentPassword }) => {
    setBanner(null)
    try {
      await mutation.mutateAsync({ username: username.trim(), currentPassword })
      reset()
      toast.show('Pseudo modifié', 'success')
    } catch (error) {
      setBanner(applyServerErrors(error, form))
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200">
      <h2 className="text-lg font-semibold">Changer de pseudo</h2>
      <FormBanner message={banner} />
      <TextField
        label="Nouveau pseudo"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        hint={USERNAME_HINT}
        error={errors.username?.message}
        {...register('username', usernameRules)}
      />
      <TextField
        label="Confirme avec ton mot de passe"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword', { required: 'Obligatoire' })}
      />
      <Button type="submit" loading={mutation.isPending}>
        Changer de pseudo
      </Button>
    </form>
  )
}
```

- [ ] **Step 7 : Page compte (`src/pages/AccountPage.tsx`)**

Ajouter l'import :

```tsx
import { ChangeUsernameForm } from './account/ChangeUsernameForm'
```

Remplacer le bloc résumé :

```tsx
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="font-medium">{me.email}</p>
          <p className="text-sm text-stone-500">Inscrit le {formatDate(me.createdAt)}</p>
        </section>
```

par :

```tsx
        <section className="rounded-2xl bg-white p-4 ring-1 ring-stone-200">
          <p className="text-lg font-semibold">@{me.username}</p>
          <p className="text-stone-700">{me.email}</p>
          <p className="text-sm text-stone-500">Inscrit le {formatDate(me.createdAt)}</p>
        </section>
```

et ajouter `<ChangeUsernameForm />` juste avant `<ChangePasswordForm />`.

- [ ] **Step 8 : Barre du haut (`src/components/Layout.tsx`)**

Ajouter l'import :

```tsx
import { useMe } from '../api/queries'
```

Au début de `Layout`, ajouter :

```tsx
  const { data: me } = useMe()
```

Remplacer le `NavLink` :

```tsx
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `grid min-h-11 place-items-center rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-rose-50 text-rose-700' : 'text-stone-700'}`
            }
          >
            Compte
          </NavLink>
```

par :

```tsx
          <NavLink
            to="/account"
            aria-label={me ? `Compte (@${me.username})` : 'Compte'}
            className={({ isActive }) =>
              `grid min-h-11 max-w-[50%] place-items-center truncate rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-rose-50 text-rose-700' : 'text-stone-700'}`
            }
          >
            {me ? `@${me.username}` : 'Compte'}
          </NavLink>
```

- [ ] **Step 9 : Lancer les tests et vérifier qu'ils passent**

Run : `npm test && npx tsc -b && npm run lint`
Expected : PASS. Dans `src/pages/AccountPage.test.tsx`, `getByLabelText('Mot de passe actuel')` reste unique, car le nouveau champ s'appelle « Confirme avec ton mot de passe ».

- [ ] **Step 10 : Validation complète**

Run : `npm run build && npm run lint && npm test`
Expected : build OK, lint sans erreur (seul l'avertissement `react(refs)` connu), tous les tests PASS.

- [ ] **Step 11 : Commit**

```bash
git add -A
git commit -m "feat: change username from the account page and show it in the header"
```

- [ ] **Step 12 : Recette manuelle (à faire par l'utilisateur contre le vrai backend)**

1. Inscription avec un pseudo accentué, puis déconnexion, puis connexion avec le pseudo dans une autre casse.
2. Création d'un pattern public, puis d'un pattern privé.
3. Avec un second compte (autre navigateur ou navigation privée) :
   - le catalogue montre le pattern public « par <pseudo> » ;
   - démarrer et avancer ;
   - le pattern apparaît dans « Mes patterns » ;
   - le menu n'a ni Modifier ni Supprimer ;
   - `/patterns/<id>/edit` affiche « Seul l'auteur… ».
4. Avec le premier compte : l'avancement est indépendant. Repasser en privé (avec confirmation) : le pattern disparaît chez le second compte.
5. Changement de pseudo ; le cas d'un pseudo déjà pris.
