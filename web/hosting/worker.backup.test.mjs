import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createWorker } from './worker.mjs';

const origin = 'https://music.blynx.vip';
const endpoint = '/api/android-backup';
const backup = {
  version: 1,
  settings: { theme: { mode: 'DARK' } },
  library: { playlists: [{ id: 'mine', name: 'My playlist', playlistOnly: true }] },
  history: [{ videoId: 'abc', title: 'My song' }],
};

function fixture() {
  const sql = new DatabaseSync(':memory:');
  for (const filename of ['0000_blynx_sync.sql', '0001_android_backup.sql']) {
    sql.exec(readFileSync(new URL('drizzle/' + filename, import.meta.url), 'utf8'));
  }
  const DB = { prepare(statement) {
    const query = sql.prepare(statement);
    return { bind(...values) {
      return { first: async () => query.get(...values), run: async () => ({ meta: query.run(...values) }) };
    } };
  } };
  const worker = createWorker({});
  return (path, options) => worker.fetch(new Request(origin + path, options), { DB });
}

function request(method, headers, body) {
  return { method, headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body) };
}

test('requires a signed-in browser to connect and isolates the Android backup by owner', async () => {
  const fetch = fixture();
  const token = 'a'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const owner = { origin, 'oai-authenticated-user-id': 'first' };
  const stranger = { origin, 'oai-authenticated-user-id': 'second' };
  const app = { 'x-blynx-backup-key': token };
  assert.equal((await fetch(endpoint + '/meta')).status, 401);
  assert.equal((await fetch(endpoint + '/connect', request('POST', { origin }, { tokenHash }))).status, 401);
  assert.equal((await fetch(endpoint + '/connect', request('POST', { ...owner, origin: 'https://other.invalid' }, { tokenHash }))).status, 403);
  assert.equal((await fetch(endpoint + '/meta', request('GET', app))).status, 401);
  assert.equal((await fetch(endpoint + '/connect', request('POST', owner, { tokenHash }))).status, 200);
  assert.equal((await fetch(endpoint + '/connect', request('POST', stranger, { tokenHash }))).status, 409);
  assert.equal((await fetch(endpoint, request('PUT', app, { revision: 0, document: backup }))).status, 200);
  assert.equal((await fetch(endpoint, request('GET', stranger))).status, 404);
  const restored = await fetch(endpoint, request('GET', owner));
  assert.equal(restored.headers.get('x-backup-revision'), '1');
  assert.deepEqual(await restored.json(), { app: 'Blynx Music', ...backup });
  assert.equal((await fetch(endpoint, request('PUT', app, { revision: 0, document: backup }))).status, 409);
  assert.equal((await fetch(endpoint, request('DELETE', app))).status, 200);
  assert.equal((await fetch(endpoint + '/meta', request('GET', app))).status, 401);
  assert.equal((await fetch(endpoint, request('GET', owner))).status, 200);
});

test('supports reinstall restore, blocks stale replacement and refuses playlist password records', async () => {
  const fetch = fixture();
  const owner = { origin, 'oai-authenticated-user-id': 'first' };
  const token = 'b'.repeat(64);
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const app = { 'x-blynx-backup-key': token };
  assert.equal((await fetch(endpoint, request('PUT', owner, { revision: 0, document: backup }))).status, 200);
  assert.equal((await fetch(endpoint + '/connect', request('POST', owner, { tokenHash }))).status, 200);
  const meta = await (await fetch(endpoint + '/meta', request('GET', app))).json();
  assert.equal(meta.revision, 1);
  assert.deepEqual(await (await fetch(endpoint, request('GET', app))).json(), { app: 'Blynx Music', ...backup });
  const invalid = { ...backup, library: { playlistPasswords: { id: { verifier: 'example' } } } };
  assert.equal((await fetch(endpoint, request('PUT', app, { revision: 1, document: invalid }))).status, 400);
  assert.equal((await fetch(endpoint, request('PUT', app, { revision: 1, document: backup }))).status, 200);
  assert.equal((await fetch(endpoint, request('PUT', owner, { revision: 1, document: backup }))).status, 409);
});
