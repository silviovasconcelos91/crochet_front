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
      return error.problem?.detail === 'Invalid username or password'
        ? 'Pseudo ou mot de passe incorrect'
        : 'Session expirée, reconnecte-toi'
    case 403:
      return error.problem?.detail?.endsWith('belongs to another account')
        ? 'Ce pattern appartient à un autre compte'
        : 'Session invalide, recharge la page'
    case 404:
      return 'Ce pattern est introuvable'
    case 409:
      return 'Pseudo ou email déjà utilisé'
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
  [/^numeric value out of bounds .*$/, 'Nombre trop grand (99,99 max, 2 décimales)'],
  [/^must be greater than 0$/, 'Doit être supérieur à 0'],
  [/^must be 3 to 30 letters, digits, '_', '-' or '\.'$/, '3 à 30 caractères : lettres, chiffres, _ - .'],
]

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

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}

export function isNotStarted(error: unknown): boolean {
  return isNotFound(error) && (error as ApiError).problem?.detail?.endsWith('is not started') === true
}
