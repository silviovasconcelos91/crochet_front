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
  ['/\t/evil.example', '/'],
  ['/\n/evil.example', '/'],
  ['/patterns/3#notes', '/patterns/3#notes'],
])('safeRedirect(%j) = %j', (value, expected) => {
  expect(safeRedirect(value)).toBe(expected)
})
