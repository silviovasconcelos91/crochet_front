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
      createdAt: '', updatedAt: '', progress: null, visibility: 'PUBLIC', author: { username: 'ana' }, mine: true,
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
