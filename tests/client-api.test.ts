import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mutate } from '../lib/client-api'

test('save returns the server result', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ data: 'product-id' }))
  assert.equal(await mutate('product.save'), 'product-id')
})

test('save preserves validation errors', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'SKU already exists.' }, { status: 409 }))
  await assert.rejects(mutate('product.save'), /SKU already exists/)
})

test('save explains hosting errors that are not JSON', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Gateway timeout</html>', { status: 504 }))
  await assert.rejects(mutate('product.save'), /HTTP 504.*Check whether your changes were saved/)
})

test('a stalled save times out without automatically retrying', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const fetchMock = t.mock.method(globalThis, 'fetch', (_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }))
  const pending = assert.rejects(mutate('product.save'), /timed out.*whether your changes were saved/)
  t.mock.timers.tick(45000)
  await pending
  assert.equal(fetchMock.mock.callCount(), 1)
})
