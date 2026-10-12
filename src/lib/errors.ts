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
