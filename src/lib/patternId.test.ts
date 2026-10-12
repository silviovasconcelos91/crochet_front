import { expect, it } from 'vitest'
import { parsePatternId } from './patternId'

it.each([
  ['12', 12],
  ['abc', null],
  ['0', null],
  ['-3', null],
  ['1.5', null],
  [undefined, null],
  ['99999999999999999999', null],
])('parsePatternId(%j) = %j', (raw, expected) => {
  expect(parsePatternId(raw)).toBe(expected)
})
