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
