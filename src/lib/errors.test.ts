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
    ['numeric value out of bounds (<2 digits>.<2 digits> expected)', 'Nombre trop grand (99,99 max, 2 décimales)'],
    ['must be greater than 0', 'Doit être supérieur à 0'],
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
