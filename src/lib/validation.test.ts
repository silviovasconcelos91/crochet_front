import { describe, expect, it } from 'vitest'
import { emailRules, newPasswordRules, requiredText, usernameRules, utf8Length } from './validation'

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

  it('newPasswordRules limite à 72 octets', () => {
    expect(newPasswordRules.validate('a'.repeat(72))).toBe(true)
    expect(newPasswordRules.validate('é'.repeat(37))).toBe('Trop long : 72 octets max (les accents comptent double)')
  })
})
