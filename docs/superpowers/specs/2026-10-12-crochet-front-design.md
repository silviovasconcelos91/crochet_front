# Front « crochet_front » — design

Date : 2026-10-12
Référence API : [`doc/front-api.md`](../../../doc/front-api.md) (source de vérité ; aucun endpoint ni champ hors de ce document).

## 1. Objectif et contexte

Front web de suivi de patterns de crochet, consommant l'API Spring Boot `crochet_back`.

- Application personnelle, **en français uniquement**.
- Usage principal **sur téléphone, pendant le crochet** : mobile-first, actions dans la zone du pouce, rang courant très lisible.
- Pas de mode hors-ligne.

Critères de succès :
- Tous les écrans listés en fin de `doc/front-api.md` sont implémentés : connexion/inscription, liste, détail avec avancement, création/édition, compte.
- Respect strict du protocole session + CSRF de l'API.
- `tsc -b`, `oxlint` et `vitest run` passent sans erreur.

## 2. Stack

| Besoin | Choix |
|---|---|
| Base | Vite + React 19 + TypeScript (existant) |
| Style | Tailwind CSS v4 (plugin Vite), mobile-first |
| Routing | react-router v7, `createBrowserRouter` (mode data, sans loaders, nécessaire pour `useBlocker`) |
| État serveur | TanStack Query v5 |
| HTTP | `fetch` encapsulé dans `api/client.ts` (pas d'axios) |
| Formulaires | react-hook-form (`useFieldArray` imbriqués) |
| Validation client | règles react-hook-form reprenant les contraintes de la doc (pas de zod) |
| Notifications | composant `Toast` maison (context + Tailwind) |
| Tests | Vitest + jsdom + Testing Library + MSW |

Configuration : `VITE_API_URL`, valeur par défaut `http://localhost:8080`. Le front tourne en dev sur `http://localhost:5173` ; le CORS backend est configuré pour cette origine avec credentials.

## 3. Architecture

### 3.1 Routes

| Route | Accès | Écran |
|---|---|---|
| `/login` | invité (redirige vers `/` si connecté) | Connexion |
| `/register` | invité (redirige vers `/` si connecté) | Inscription |
| `/` | connecté | Liste des patterns |
| `/patterns/new` | connecté | Création |
| `/patterns/:id` | connecté | Détail + avancement |
| `/patterns/:id/edit` | connecté | Édition |
| `/account` | connecté | Compte |
| `*` | — | 404 |

Chaque route racine a un `errorElement` (écran « Oups » + bouton recharger).

### 3.2 Arborescence `src/`

```
api/
  client.ts      api<T>(), ApiError, lecture du cookie XSRF-TOKEN, nouvel essai CSRF sur 403
  types.ts       Account, Row, Step, Progress, ProgressStatus, Pattern, PatternSummary, PatternInput, ProgressInput
  auth.ts        fetchCsrf, register, login, logout, getMe, changePassword, deleteAccount
  patterns.ts    listPatterns, getPattern, createPattern, updatePattern, deletePattern, putProgress, deleteProgress
  queries.ts     clés de query + hooks (useMe, usePatterns, usePattern, mutations)
lib/
  progress.ts    fonctions pures de navigation dans les rangs
  rowNumber.ts   nextRowNumber("3-5") → "6"
  formErrors.ts  conversion des chemins d'erreur serveur → chemins react-hook-form
  errors.ts      ApiError → message français
auth/
  RequireAuth.tsx, GuestOnly.tsx
components/
  Layout, Button, TextField, TextArea, FieldError, FormBanner, ConfirmDialog, Spinner, Skeleton, Toast (provider + hook)
pages/
  LoginPage, RegisterPage, PatternListPage, PatternDetailPage, PatternFormPage, AccountPage, NotFoundPage
  (sous-composants propres à une page dans un dossier pages/<page>/ si la page grossit : StepFields, ProgressBar, RowItem…)
```

Chaque unité a une responsabilité unique. `lib/` ne contient que des fonctions pures testables sans React.

### 3.3 Flux global

- **Démarrage** : `GET /api/auth/csrf`, puis `GET /api/me` (query `['me']`). Un 401 sur `/api/me` donne `me = null`, ce n'est pas une erreur. L'application n'est pas affichée (spinner plein écran) avant la fin de ces deux appels.
- **Clés de query** : `['me']`, `['patterns']` (liste), `['patterns', id]` (détail).
- **401 global** : `onError` de `QueryCache` et `MutationCache`. Tout 401, sauf sur `POST /api/auth/login`, met `['me']` à `null` ; `RequireAuth` redirige alors vers `/login?redirect=<chemin courant>`.
- **Login / inscription réussis** : `setQueryData(['me'], account)`, puis navigation vers `redirect` (s'il commence par `/`) ou `/`.
- **Logout / suppression du compte** : `queryClient.clear()`, `['me'] = null`, navigation vers `/login`.
- **Mutations de pattern** : la réponse met à jour `['patterns', id]`, et `['patterns']` est invalidée. Une suppression retire `['patterns', id]` et invalide la liste.

## 4. Client API (`api/client.ts`)

- `credentials: 'include'` sur toutes les requêtes.
- `Content-Type: application/json` quand il y a un corps (y compris `DELETE /api/me`).
- Pour `POST`, `PUT` et `DELETE` : lecture du cookie `XSRF-TOKEN` **au moment de chaque requête** (jamais mis en cache), envoyé décodé dans l'en-tête `X-XSRF-TOKEN`.
- `204` → `undefined`. Corps JSON lu en tolérant un corps vide ou illisible.
- Si la réponse n'est pas OK, on lève une `ApiError` :
  - `status: number` (`0` si `fetch` lui-même échoue : réseau, CORS) ;
  - `problem` : objet Problem Details ou `null` ;
  - `fieldErrors: { field: string; message: string }[]` (vide si absent) ;
  - `retryAfter: number | null` (secondes, depuis l'en-tête `Retry-After`).
- **403** : un seul nouvel essai automatique, en appelant `GET /api/auth/csrf` puis en rejouant la requête. Si l'échec persiste, on lève l'erreur.

## 5. Écrans

### 5.1 Connexion / inscription

- **Connexion** : email et mot de passe. Pour une 401 : bandeau « Email ou mot de passe incorrect ». Lien vers l'inscription.
- **Inscription** : email, mot de passe et confirmation.
  - Validation client : email requis, 254 caractères max ; mot de passe de 8 caractères minimum et 72 octets UTF-8 maximum (`TextEncoder`) ; confirmation identique.
  - Une 409 s'affiche sur le champ email : « Cet email est déjà utilisé ».
- Les deux écrans gèrent la 429 (§6).

### 5.2 Liste (`/`)

- Cartes : vignette (`imageUrl`, sinon un placeholder), titre, crochet (mm) et laine si présents.
- Badge d'état :
  - `Non commencé` (`progress === null`) ;
  - `En cours · étape X/Y` (`stepIndex + 1` / `stepCount`) ;
  - `Terminé`.
- Onglets de filtre côté client : Tous / En cours / Terminés / Non commencés. Le tri est celui renvoyé par le serveur.
- Bouton flottant `+` vers `/patterns/new`. Si la liste est vide, invitation à créer un premier pattern.
- Squelettes pendant le chargement.

### 5.3 Détail et avancement (`/patterns/:id`)

**En-tête** : retour, titre, menu `⋯`. Image si présente, crochet et laine, lien source (nouvel onglet), description repliable. Badge d'état :
- `En cours — étape X/Y` ;
- `Terminé le JJ/MM/AAAA` (`finishedAt`) ;
- `Non commencé`.

**Corps** : étapes numérotées, chacune avec ses rangs (`number` à gauche, `value` à droite).
- Rang courant : surligné, texte plus grand, marqueur visuel.
- Rangs et étapes passés : grisés. Les étapes passées sont repliables.
- Défilement automatique centrant le rang courant à l'ouverture et à chaque changement de position.
- **Toucher un rang** le définit comme position courante via `PUT progress` (`status` inchangé, ou `IN_PROGRESS` si le pattern n'était pas commencé). Pas de confirmation, l'action est réversible.

**Barre d'action fixe en bas** :
- non commencé : `[Démarrer]`, qui envoie `{ status: IN_PROGRESS, stepIndex: 0, rowIndex: 0 }` ;
- en cours :
  - `[◀ Précédent]`, désactivé au tout premier rang ;
  - gros bouton `[Rang suivant ▶]`, qui devient `[Terminer ✓]` (`status: FINISHED`, position inchangée) sur le dernier rang de la dernière étape ;
- terminé : `[Rouvrir]`, qui envoie `IN_PROGRESS` à la même position.

**Menu `⋯`** :
- Modifier ;
- Terminer (à tout moment, si en cours) ;
- Abandonner l'avancement (confirmation, `DELETE progress`, uniquement si commencé) ;
- Supprimer le pattern (confirmation, puis retour à la liste) ;
- interrupteur « Écran toujours allumé ».

**Mises à jour d'avancement** :
- Optimistes : on écrit tout de suite dans `['patterns', id]`. En cas d'erreur, on revient à l'état précédent et un toast s'affiche. En cas de succès, on écrit le `Progress` renvoyé et on invalide `['patterns']`.
- Sérialisées via `scope: { id: 'progress-<id>' }`. Chaque nouvelle position est calculée à partir du cache courant, ce qui permet les clics rapides.
- Abandon : une 404 « not started » est traitée comme un succès, suivie d'un rechargement.

**Écran toujours allumé** : Wake Lock API, activé par défaut tant que la page est visible et que le pattern est en cours. Le verrou est redemandé après `visibilitychange`. Le choix est mémorisé dans `localStorage` (lecture et écriture protégées par try/catch). Si le navigateur ne gère pas l'API, on l'ignore sans erreur.

**404** : écran « Pattern introuvable » avec un lien vers la liste.

### 5.4 Navigation dans les rangs (`lib/progress.ts`)

Fonctions pures sur `(steps: Step[], pos: { stepIndex, rowIndex })` :
- `nextPosition` : `rowIndex + 1` si possible, sinon étape suivante avec `rowIndex = 0`, sinon `null` (fin) ;
- `prevPosition` : `rowIndex - 1` si possible, sinon dernier rang de l'étape précédente, sinon `null` ;
- `isLastRow`, `isFirstRow` ;
- `compareToCurrent(stepIndex, rowIndex, progress)` → `'past' | 'current' | 'future'`.

### 5.5 Formulaire de pattern (`/patterns/new`, `/patterns/:id/edit`)

**Champs** :
- titre* (≤ 200) ;
- description (zone de texte) ;
- crochet en mm (`inputMode="decimal"`, la virgule est acceptée et convertie en point ; `0 < x ≤ 99.99`, 2 décimales max) ;
- laine (≤ 200) ;
- URL source (≤ 500) ;
- URL image (≤ 500, avec aperçu).

**Étapes** (`useFieldArray`) :
- titre* (≤ 200) ;
- repliables, avec un résumé « titre (N rangs) » ;
- boutons ↑↓ pour réordonner et suppression (désactivée s'il ne reste qu'une étape) ;
- `+ Étape` ajoute une étape avec un rang vide.

**Rangs** (composant `StepFields`, `useFieldArray` imbriqué) :
- `number`* (≤ 20, champ court) et `value`* (zone de texte qui grandit avec le contenu) ;
- suppression (désactivée s'il ne reste qu'un rang) ;
- `+ Rang` pré-remplit `number` avec `nextRowNumber(dernier number)` :
  - `"2"` → `"3"` ;
  - `"3-5"` → `"6"` ;
  - texte non numérique → `""`.

**Édition** :
- chargement du pattern, avec les `null` convertis en `""` dans les valeurs par défaut ;
- si le pattern est commencé, bandeau d'info : « Si tu supprimes le rang en cours, l'avancement sera recalé sur le dernier rang existant ».

**Envoi** :
- trim des textes, `""` → `null` pour les champs facultatifs, `hookSizeMm` converti en nombre ;
- création (`POST`) → navigation vers `/patterns/{id}` ;
- édition (`PUT`, pattern complet) → navigation vers le détail.

**Autres comportements** :
- barre fixe en bas avec `[Enregistrer]`, désactivée et avec spinner pendant l'envoi ;
- modifications non enregistrées : confirmation en quittant la page (`useBlocker`), plus `beforeunload` ;
- **hors scope** : collage en masse de rangs, duplication d'étape, brouillon local, glisser-déposer.

### 5.6 Compte (`/account`)

- Affichage de l'email et de la date d'inscription (format `fr-FR`).
- **Changer le mot de passe** : actuel, nouveau et confirmation (mêmes règles qu'à l'inscription).
  - En cas de succès : toast « Mot de passe modifié », formulaire vidé.
  - Un mot de passe actuel incorrect arrive en 400 sur `currentPassword`, affichée sous le champ.
- **Déconnexion**.
- **Zone danger** : supprimer le compte.
  - Saisie du mot de passe, puis `ConfirmDialog` qui explique que tous les patterns seront supprimés.
  - Erreur 400 sur `password` affichée sous le champ.
  - En cas de succès : flux de logout (§3.3).

### 5.7 Layout

En-tête compact : titre de l'app, lien vers la liste, lien vers le compte. Contenu sur une seule colonne, largeur max confortable sur desktop, marges de 16 px sur mobile. Cibles tactiles d'au moins 44 px.

## 6. Erreurs

**Messages** (`lib/errors.ts`) :

| Cas | Traitement |
|---|---|
| `0` | « Serveur injoignable, vérifie ta connexion » |
| `400` avec `errors` | erreurs sur les champs (ci-dessous) |
| `400` sans `errors` | « Requête invalide » |
| `401` sur le login | « Email ou mot de passe incorrect » |
| `401` ailleurs | redirection vers le login (§3.3) |
| `403` (après le nouvel essai) | « Session invalide, recharge la page » |
| `404` | écran introuvable (détail ou édition) ou toast (mutation) |
| `409` | sur le champ email : « Cet email est déjà utilisé » |
| `429` | « Trop de tentatives, réessaie dans N min » (`ceil(retryAfter / 60)`), ou « dans N s » si moins de 60 s |
| `500` / autre | « Erreur inattendue, réessaie plus tard » |

**Erreurs de champ** (`lib/formErrors.ts`, tous les formulaires) :
- `steps[0].rows[1].value` devient `steps.0.rows.1.value`, puis passe par `setError`.
- Défilement et focus sur le premier champ en erreur. L'étape contenant l'erreur est dépliée.
- Une erreur sur un champ absent du formulaire (ex : `steps`) va dans le `FormBanner` en haut du formulaire.

**Requêtes** :
- `retry` : aucun nouvel essai sur les 4xx, un seul pour le statut `0` et les 5xx.
- Erreurs de mutation hors formulaire (avancement, suppression) : affichées en toast.

## 7. Tests

Vitest + jsdom + Testing Library + MSW (handlers qui imitent l'API, y compris la vérification de l'en-tête CSRF).

**Unitaires** :
- `progress.ts` : suivant/précédent dans une étape, changement d'étape, premier et dernier rang, étape à un seul rang ;
- `rowNumber.ts` : `"2"`, `"3-5"`, `"10"`, texte libre ;
- `formErrors.ts` : chemins simples et imbriqués ;
- `errors.ts` : 429 en minutes et en secondes, chaque code.

**Client** :
- `X-XSRF-TOKEN` relu à chaque appel, même après changement du cookie ;
- `credentials: 'include'` ;
- 204, problem+json, `Retry-After` ;
- nouvel essai unique après une 403 ;
- échec réseau qui donne le statut 0.

**Pages (MSW)** :
- login réussi qui redirige vers `redirect` ; login en échec (401) ;
- un 401 sur une page protégée renvoie au login avec `redirect` ;
- inscription : 409 affichée sur l'email ;
- détail : « Rang suivant » met l'UI à jour avant la réponse ; en cas d'erreur serveur, retour à l'état précédent et toast ;
- formulaire : payload avec `""` → `null` et virgule → point ; erreur `steps[0].rows[1].value` affichée sur le bon champ.

**Hors scope** : tests e2e. Validation manuelle contre le vrai backend.

**Validation finale** : `npm run build` (`tsc -b` + `vite build`), `npm run lint`, `npm test`.
