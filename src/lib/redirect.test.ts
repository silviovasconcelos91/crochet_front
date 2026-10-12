import { expect, it } from 'vitest'
import { safeRedirect } from './redirect'

it.each([
  [null, '/'],
  ['', '/'],
  ['/account', '/account'],
  ['/patterns/3?x=1', '/patterns/3?x=1'],
  ['//evil.example', '/'],
  ['/\\evil.example', '/'],
  ['https://evil.example', '/'],
  ['account', '/'],
])('safeRedirect(%j) = %j', (value, expected) => {
  expect(safeRedirect(value)).toBe(expected)
})
