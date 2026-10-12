# Pseudo, visibilité et catalogue public — design

Date : 2026-10-12
Référence API : [`doc/front-api.md`](../../../doc/front-api.md), version qui introduit pseudo, visibilité et catalogue public. Elle reste la source de vérité.
Complète : [`2026-10-12-crochet-front-design.md`](2026-10-12-crochet-front-design.md). Tout ce qui n'est pas modifié ici reste valable.

## 1. Objectif

Aligner le front sur la nouvelle API :
- **connexion par pseudo** et pseudo obligatoire à l'inscription ;
- **visibilité** `PRIVATE` / `PUBLIC` des patterns, avec un **catalogue public** ;
- **avancement propre à chaque compte**, y compris sur les patterns publics des autres ;
- **changement de pseudo** dans le compte.

Critères de succès :
- le front fonctionne contre le nouveau backend, notamment la connexion par pseudo et les messages d'erreur 401, 403 et 409 ;
- toutes les fonctionnalités listées en fin de `doc/front-api.md` sont présentes ;
- `npm run build`, `npm run lint` et `npm test` passent sans erreur.

## 2. Ruptures à corriger (le front actuel est incompatible)

| Changement API | Effet sur le front actuel | Correction |
|---|---|---|
| Login `{ username, password }` | Le formulaire envoie `email` | Champ « Pseudo » |
| Register `{ username, email, password }` | Pseudo absent | Champ « Pseudo » + validation client |
| 401 `Invalid username or password` | Reconnu comme « Session expirée » | Nouveau message (§4.2) |
| 409 `Already used` + `errors` (`username` et/ou `email`) | Toujours affichée sous l'email | Mapping générique des erreurs de champ (§4.2) |
| 403 `Pattern N belongs to another account` | Prise pour une 403 CSRF : nouvel essai, puis « Session invalide » | Nouvel essai CSRF limité à `Access denied` (§4.1) |
| `PatternInput.visibility` omis donne `PRIVATE`, y compris sur `PUT` | Une édition repasserait un pattern public en privé | Toujours envoyer `visibility` (§6.2) |

## 3. Types (`api/types.ts`)

```ts
type Visibility = 'PRIVATE' | 'PUBLIC'
interface Author { username: string }
interface Account { id: number; username: string; email: string; createdAt: string }
// Pattern et PatternSummary gagnent : visibility: Visibility; author: Author; mine: boolean
// PatternInput gagne : visibility?: Visibility
```

## 4. Couche API

### 4.1 Client (`api/client.ts`)

- Le nouvel essai CSRF après une 403 n'a lieu que si `problem` est absent ou si `problem.detail === 'Access denied'`.
- Toute autre 403 (ex. `belongs to another account`) est levée directement, sans nouvel essai.

### 4.2 Messages (`lib/errors.ts`, `lib/formErrors.ts`)

**Messages par statut :**

| Cas | Message |
|---|---|
| 401 `Invalid username or password` | « Pseudo ou mot de passe incorrect » |
| 401 autre | « Session expirée, reconnecte-toi » (inchangé) |
| 403 `… belongs to another account` | « Ce pattern appartient à un autre compte » |
| 403 autre | « Session invalide, recharge la page » (inchangé) |
| 409 sans erreur de champ exploitable | « Pseudo ou email déjà utilisé » |

**Traductions** des messages serveur :
- `is already used` sur `username` : « Ce pseudo est déjà pris ».
- `is already used` sur `email` : « Cet email est déjà utilisé ».
- `must be 3 to 30 letters, digits, '_', '-' or '.'` : « 3 à 30 caractères : lettres, chiffres, _ - . »

La traduction devient fonction du champ et du message : `translateServerMessage(message, field?)`.

**Inscription** : la 409 passe par `applyServerErrors` comme les autres erreurs. Le cas particulier actuel de la 409 est supprimé.

### 4.3 Endpoints

- `auth.ts` :
  - `login({ username, password })` ;
  - `register({ username, email, password })` ;
  - `changeUsername({ username, currentPassword }): Promise<Account>`.
- `patterns.ts` : `listPublicPatterns(): Promise<PatternSummary[]>` (`GET /api/patterns/public`).

### 4.4 Cache (`api/queries.ts`)

- Nouvelle clé `queryKeys.publicPatterns = ['patterns', 'public']`.
  - `queryKeys.pattern(id)` reste `['patterns', id]` : il n'y a pas de collision, `id` est un nombre.
- Helper `invalidateLists(queryClient)` : invalide `['patterns']` et `['patterns', 'public']` en `exact`. Il remplace les invalidations existantes :
  - avancement ;
  - enregistrement ;
  - suppression de pattern ;
  - abandon.
- La suppression d'un pattern le retire aussi de la liste publique en cache.
- Nouveau hook `usePublicPatterns()` et nouvelle mutation `useChangeUsername()`. En cas de succès, la mutation écrit l'`Account` renvoyé dans `me`.

## 5. Accueil (`/`)

- **Onglets** :
  - « Mes patterns » et « Catalogue », sous le titre de la page ;
  - onglet actif lu depuis `?onglet=catalogue` (absent : Mes patterns) ;
  - changement d'onglet par `setSearchParams` en mode `replace`, pour ne pas empiler d'historique.
- **Mes patterns** :
  - union de `GET /api/patterns` et des éléments de `GET /api/patterns/public` qui vérifient `!mine && progress !== null` ;
  - dédoublonnage par `id` ;
  - tri par titre (`localeCompare` en `fr`, sensibilité `base`) ;
  - chargement terminé quand les deux requêtes ont abouti ; erreur si l'une échoue.
  - Fonction pure `mergeMyPatterns(mine, publics)` dans `lib/patternLists.ts`.
- **Catalogue** : `GET /api/patterns/public` tel quel. Le serveur le trie déjà.
- **Filtres** Tous / En cours / Terminés / Non commencés : dans les deux onglets, réinitialisés à « Tous » au changement d'onglet.
- **Cartes** :
  - « par <pseudo> » si `!mine` ;
  - badge « Public » si `mine && visibility === 'PUBLIC'`.
- **États vides** :
  - Mes patterns : inchangé (invitation à créer) ;
  - Catalogue : « Aucun pattern public pour l’instant. »
  - Le message « Aucun pattern dans cette catégorie. » reste pour un filtre vide.
- **Bouton `+`** : uniquement sur l'onglet Mes patterns.

## 6. Détail et formulaire

### 6.1 Détail (`/patterns/:id`)

- **Sous le titre** :
  - « par <pseudo> » si `!mine` ;
  - badge « Public » ou « Privé » si `mine`.
- **Menu ⋯** :
  - Modifier et Supprimer seulement si `mine` ;
  - Terminer, Abandonner l'avancement et l'interrupteur d'écran allumé pour tous.
- **Confirmation de suppression** d'un pattern `PUBLIC` : « Le pattern, ton avancement et celui des autres comptes seront définitivement supprimés. »
- **Pattern devenu privé ou supprimé par son auteur** : la 404 affiche « Pattern introuvable » (comportement existant).

### 6.2 Formulaire

- **Groupe radio « Visibilité »** (`fieldset` + `legend`) :
  - « Privé — visible par moi seul » (`PRIVATE`, par défaut à la création) ;
  - « Public — lisible par tous les comptes connectés » (`PUBLIC`).
- **Modèle** :
  - `PatternFormValues.visibility: Visibility` ;
  - `toFormValues` le reprend du pattern ;
  - `toPatternInput` l'envoie **toujours**.
- **Édition `PUBLIC` vers `PRIVATE`** :
  - à l'envoi valide, un `ConfirmDialog` s'ouvre avant le `PUT` : titre « Rendre ce pattern privé ? », message « Les autres comptes perdront l'accès à ce pattern et leur avancement. », bouton « Rendre privé » ;
  - Annuler n'envoie rien.
- **Édition du pattern d'un autre** (`/patterns/:id/edit` avec `mine === false`) :
  - écran « Seul l’auteur peut modifier ce pattern » avec un lien « Retour au pattern » ;
  - aucun formulaire.
- **403 `belongs to another account` à l'enregistrement** : message dans le bandeau (§4.2).
- **Brouillon de session expirée** : il inclut `visibility`.

## 7. Authentification et compte

**Connexion** :
- champs « Pseudo » (`autocomplete="username"`, requis) et « Mot de passe » ;
- bandeau sur la 401 et la 429 (inchangé).

**Inscription** :
- champs Pseudo, Email, Mot de passe, Confirmation ;
- règle client du pseudo, partagée avec le compte : `usernameRules` dans `lib/validation.ts` ;
  - après trim, `/^[\p{L}\p{N}_.-]{3,30}$/u` ;
  - message : « 3 à 30 caractères : lettres, chiffres, _ - . » ;
- le pseudo est envoyé trimé, en gardant la casse saisie.

**Compte** :
- **Résumé** : pseudo (en titre du bloc), email, date d'inscription.
- **Bloc « Changer de pseudo »** :
  - champs « Nouveau pseudo » (`usernameRules`) et « Mot de passe actuel » ;
  - succès : `me` mis à jour, toast « Pseudo modifié », formulaire vidé ;
  - erreurs : `username` et `currentPassword` sous leur champ, le reste dans le bandeau.
- **Barre du haut** : le lien vers le compte affiche `@<pseudo>`. Son libellé accessible devient « Compte (@<pseudo>) ».

## 8. Tests

**Faux backend** (`src/test/`) :
- comptes avec `username` ;
- login par pseudo, insensible à la casse ;
- 409 avec `errors` ;
- `PUT /api/me/username` ;
- patterns avec `visibility`, `author` et `mine` calculés pour le compte connecté ;
- avancement **par compte** : `progress` stocké par `(patternId, accountId)` ;
- `GET /api/patterns/public` ;
- 404 sur un pattern privé d'un autre compte ;
- 403 `belongs to another account` sur `PUT` ou `DELETE` d'un pattern public d'un autre ;
- repasser en `PRIVATE` supprime l'avancement des autres comptes ;
- seeds : `seedAccount({ username })`, `seedPattern(ownerId, { visibility })`, `seedProgress(patternId, accountId, progress)`.

**Unitaires** :
- `mergeMyPatterns` : union, dédoublonnage, tri, exclusion des patterns publics non commencés ;
- `usernameRules` ;
- traductions dépendant du champ ;
- client : une 403 « autre compte » n'entraîne pas de nouvel essai CSRF.

**Pages** :
- connexion par pseudo ; 401 « Pseudo ou mot de passe incorrect » ;
- inscription : 409 sur les deux champs ;
- onglets : URL, catalogue avec auteur, pattern public commencé visible dans Mes patterns ;
- détail d'un pattern d'un autre : auteur affiché, ni Modifier ni Supprimer, avancement possible ;
- formulaire :
  - `visibility` envoyée sur `POST` et `PUT` ;
  - confirmation public → privé, avec Annuler qui n'envoie rien ;
  - écran « Seul l’auteur… » ;
- compte : changement de pseudo, mise à jour de l'en-tête, erreurs 409 et mot de passe.

## 9. Hors scope

- Pagination du catalogue (l'API n'en propose pas).
- Recherche et tri dans le catalogue.
- Profil public d'un auteur.
- Copier le pattern d'un autre dans mes patterns.
