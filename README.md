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
