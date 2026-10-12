import { expect, it } from 'vitest'
import { nextRowNumber } from './rowNumber'

it.each([
  ['2', '3'],
  ['3-5', '6'],
  ['10', '11'],
  [' 7 ', '8'],
  ['Rang 4', '5'],
  ['abc', ''],
  ['', ''],
])('nextRowNumber(%j) = %j', (previous, expected) => {
  expect(nextRowNumber(previous)).toBe(expected)
})
