import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createWorker } from './worker.mjs';

test('sync isolates accounts, strips provider credentials and detects simultaneous saves', async () => {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('./drizzle/0000_blynx_sync.sql', import.meta.url), 'utf8'));
  const DB = { prepare(sql) { return { bind(...values) {
    const statement = db.prepare(sql);
    return {
      first: async () => statement.get(...values),
      run: async () => ({ meta: statement.run(...values) }),
    };
  } }; } };
  const app = createWorker({});
  const origin = 'https://blynx.example';
  const endpoint = origin + '/api/blynx-sync/' + 'a'.repeat(64);
  const send = (owner, state, revision = 0, requestOrigin = origin) => app.fetch(new Request(endpoint, {
    headers: {
      ...(owner ? { 'oai-authenticated-user-id': owner } : {}),
      ...(state ? { origin: requestOrigin, 'content-type': 'application/json' } : {}),
    },
    method: state ? 'PUT' : 'GET',
    body: state ? JSON.stringify({ state, revision }) : undefined,
  }), { DB });
  assert.equal((await send()).status, 401);
  assert.equal((await send('owner-a', {}, 0, 'https://other.example')).status, 403);
  const state = { 'opentune:lyrics': JSON.stringify({ order: ['lrclib'], paxsenixKey: 'secret' }), 'blynx:custom-css': '.ot-mini { color: red; }' };
  const saved = await send('owner-a', state);
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).state['opentune:lyrics'], '{"order":["lrclib"]}');
  assert.equal((await send('owner-a', state)).status, 409);
  assert.equal((await send('owner-a', state, 1)).status, 200);
  assert.deepEqual(await (await send('owner-b')).json(), { revision: 0, state: {} });
  assert.equal((await (await send('owner-a')).json()).revision, 2);
  assert.equal((await send('owner-a', { secret: 'rejected' }, 2)).status, 400);
});

test('public invite and pairing routes have canonical addresses', async () => {
  const origin = 'https://music.blynx.vip';
  const routes = ['together', 'pair', 'remote', 'devices'];
  const assets = Object.fromEntries(routes.map((route) => [
    `/${route}/index.html`, ['text/html', Buffer.from(route).toString('base64')],
  ]));
  const app = createWorker(assets);
  for (const route of routes) {
    const url = `${origin}/${route}/`;
    const response = await app.fetch(new Request(url.slice(0, -1)), {});
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), url);
    assert.equal((await app.fetch(new Request(url), {})).status, 200);
  }
});
