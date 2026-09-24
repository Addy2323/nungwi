import { test } from 'node:test'
import assert from 'node:assert/strict'
import { types } from 'pg'
import '../lib/server/db'

test('catalogue numeric parser accepts alcohol percentages seeded by migration 003', () => {
  const parse = types.getTypeParser(1700, 'text')
  for (const value of ['5.50', '4.50', '4.80', '0.00', '35.00']) {
    assert.equal(parse(value), Number(value))
  }
})

test('numeric money sums remain numbers within the safe integer range', () => {
  const parse = types.getTypeParser(1700, 'text')
  for (const value of ['0', '5000000000', '9007199254740991', '-9007199254740991']) {
    assert.equal(parse(value), Number(value))
  }
  for (const value of ['9007199254740992', '-9007199254740992', 'NaN', 'Infinity', '-Infinity']) {
    assert.throws(() => parse(value), /safe range/)
  }
})

test('BIGINT parser still rejects fractional and unsafe integers', () => {
  const parse = types.getTypeParser(20, 'text')
  assert.equal(parse('5000000000'), 5000000000)
  assert.throws(() => parse('5.50'), /safe range/)
  assert.throws(() => parse('9007199254740992'), /safe range/)
})
