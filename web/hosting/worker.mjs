const syncPath = /^\/api\/blynx-sync\/([a-f0-9]{64})$/;
const limits = {
  'opentune:appearance': 2000, 'opentune:player': 2000, 'opentune:session': 300000,
  'opentune:recent-searches': 8000, 'opentune:lyrics': 4000, 'opentune:jiosaavn': 5,
  'opentune:sidebar-collapsed': 1, 'blynx:custom-css': 12000,
};
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
const empty = () => ({ revision: 0, state: {} });

async function readJson(request, maxBytes = 370000) {
  const stream = request.body?.getReader();
  if (!stream) throw new Error('Missing body');
  const decoder = new TextDecoder();
  let size = 0;
  let body = '';
  try {
    for (;;) {
      const chunk = await stream.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) throw new Error('Body too large');
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally { await stream.cancel().catch(() => {}); }
}

function validState(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid state');
  const state = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(limits, key) || typeof value !== 'string' || value.length > limits[key]) throw new Error('Invalid field');
    if (key === 'opentune:lyrics') {
      const { order, disabled, preferSyllables } = JSON.parse(value);
      state[key] = JSON.stringify({ order, disabled, preferSyllables });
    } else {
      state[key] = value;
    }
  }
  return state;
}

async function sync(request, url, db, profile) {
  const owner = request.headers.get('oai-authenticated-user-id');
  if (!owner) return json({ error: 'Sign in to sync' }, 401);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT revision, state FROM blynx_sync WHERE owner = ? AND profile = ?').bind(owner, profile).first();
    return json(row ? { revision: row.revision, state: JSON.parse(row.state) } : empty());
  }
  if (request.method !== 'PUT') return json({ error: 'Method unavailable' }, 405);
  if (request.headers.get('origin') !== url.origin || !request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Same-origin JSON required' }, 403);
  }
  let current;
  let state;
  try {
    current = await readJson(request);
    if (!Number.isSafeInteger(current.revision) || current.revision < 0) throw new Error('Invalid revision');
    state = validState(current.state);
  } catch { return json({ error: 'Invalid sync data' }, 400); }
  const revision = current.revision + 1;
  const encoded = JSON.stringify(state);
  const sql = current.revision === 0
    ? 'INSERT INTO blynx_sync (state, revision, owner, profile) VALUES (?, ?, ?, ?) ON CONFLICT(owner, profile) DO NOTHING'
    : 'UPDATE blynx_sync SET state = ?, revision = ? WHERE owner = ? AND profile = ? AND revision = ?';
  const params = current.revision === 0 ? [encoded, revision, owner, profile] : [encoded, revision, owner, profile, current.revision];
  const result = await db.prepare(sql).bind(...params).run();
  return result.meta.changes === 1 ? json({ revision, state }) : json({ error: 'Sync changed' }, 409);
}

const backupPath = '/api/android-backup';
const hexSecret = /^[a-f0-9]{64}$/;
const maxBackupBody = 6 * 1024 * 1024;

async function sha256(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function compressBackup(document) {
  const stream = new Blob([JSON.stringify(document)]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const chunks = [];
  for (let i = 0; i < bytes.length; i += 0x6000) chunks.push(btoa(String.fromCharCode(...bytes.subarray(i, i + 0x6000))));
  return chunks.join('');
}

function backupStream(payload) {
  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  return new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
}

async function androidBackup(request, url, db) {
  const route = url.pathname.slice(backupPath.length);
  const browserOwner = request.headers.get('oai-authenticated-user-id');
  const sameOrigin = request.headers.get('origin') === url.origin;
  if (route === '/connect') {
    if (request.method !== 'POST') return json({ error: 'Method unavailable' }, 405);
    if (!browserOwner) return json({ error: 'Sign in to connect a device' }, 401);
    if (!sameOrigin) return json({ error: 'Same-origin request required' }, 403);
    let tokenHash;
    try { ({ tokenHash } = await readJson(request, 1024)); } catch { return json({ error: 'Invalid connection' }, 400); }
    if (typeof tokenHash !== 'string' || !hexSecret.test(tokenHash)) return json({ error: 'Invalid connection' }, 400);
    const now = Date.now();
    await db.prepare('DELETE FROM android_backup_devices WHERE owner = ? AND expires_at <= ?').bind(browserOwner, now).run();
    await db.prepare('INSERT INTO android_backup_devices (token_hash, owner, expires_at) VALUES (?, ?, ?) ON CONFLICT(token_hash) DO NOTHING')
      .bind(tokenHash, browserOwner, now + 365 * 86400000).run();
    const device = await db.prepare('SELECT owner FROM android_backup_devices WHERE token_hash = ?').bind(tokenHash).first();
    return device?.owner === browserOwner ? json({ connected: true }) : json({ error: 'Connection already used' }, 409);
  }
  const token = request.headers.get('x-blynx-backup-key') ?? '';
  const key = hexSecret.test(token) ? await sha256(token) : null;
  const device = key && await db.prepare('SELECT owner FROM android_backup_devices WHERE token_hash = ? AND expires_at > ?')
    .bind(key, Date.now()).first();
  const owner = token ? device?.owner : browserOwner;
  if (!owner) return json({ error: 'Sign in or connect Android' }, 401);
  if (route === '/meta' && request.method === 'GET') {
    const row = await db.prepare('SELECT revision, saved_at AS savedAt FROM android_backups WHERE owner = ?').bind(owner).first();
    return json({ ...(row ?? { revision: 0, savedAt: null }),
      accountLabel: token ? null : request.headers.get('oai-authenticated-user-email') });
  }
  if (route !== '') return json({ error: 'Unknown backup route' }, 404);
  if (request.method === 'GET') {
    const row = await db.prepare('SELECT payload, revision FROM android_backups WHERE owner = ?').bind(owner).first();
    if (!row) return json({ error: 'No Android backup' }, 404);
    return new Response(backupStream(row.payload), {
      headers: { 'content-type': 'application/json', 'cache-control': 'private, no-store',
        'content-disposition': 'attachment; filename="blynx-music-backup.json"', 'x-backup-revision': String(row.revision),
        'x-content-type-options': 'nosniff' },
    });
  }
  if (request.method === 'DELETE' && device) {
    await db.prepare('DELETE FROM android_backup_devices WHERE token_hash = ?').bind(key).run();
    return json({ disconnected: true });
  }
  if (request.method !== 'PUT') return json({ error: 'Method unavailable' }, 405);
  if ((!device && !sameOrigin) || !request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Authenticated JSON request required' }, 403);
  }
  let revision, payload;
  try {
    let document;
    ({ revision, document } = await readJson(request, maxBackupBody));
    if (!Number.isSafeInteger(revision) || revision < 0 || !isObject(document) || document.version !== 1 ||
        !isObject(document.settings) || !isObject(document.library) || !Array.isArray(document.history)) throw new Error();
    const { settings, library, history } = document;
    // Android exports omit password-protected playlists and credentials.
    if (Object.keys(library.playlistPasswords ?? {}).length) throw new Error();
    payload = await compressBackup({ app: 'Blynx Music', version: 1, settings, library, history });
    if (payload.length > 1750000) return json({ error: 'Backup exceeds storage limit' }, 413);
  } catch { return json({ error: 'Invalid Blynx Music backup' }, 400); }
  const savedAt = Date.now();
  const next = revision + 1;
  const statement = revision === 0
    ? db.prepare('INSERT INTO android_backups (owner, revision, saved_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner) DO NOTHING').bind(owner, next, savedAt, payload)
    : db.prepare('UPDATE android_backups SET revision = ?, saved_at = ?, payload = ? WHERE owner = ? AND revision = ?')
      .bind(next, savedAt, payload, owner, revision);
  const result = await statement.run();
  return result.meta.changes === 1 ? json({ revision: next, savedAt }) : json({ error: 'A newer backup exists' }, 409);
}

export function createWorker(files) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname === backupPath || url.pathname.startsWith(backupPath + '/')) {
        try { return await androidBackup(request, url, env.DB); }
        catch { return json({ error: 'Android backup temporarily unavailable' }, 503); }
      }
      const profile = syncPath.exec(url.pathname)?.[1];
      if (profile) {
        try { return await sync(request, url, env.DB, profile); }
        catch { return json({ error: 'Sync temporarily unavailable' }, 503); }
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
      if (['/player', '/together', '/pair', '/remote', '/devices', '/backup'].includes(url.pathname)) {
        url.pathname += '/';
        return Response.redirect(url, 308);
      }
      let path;
      try { path = decodeURIComponent(url.pathname); } catch { return new Response(null, { status: 400 }); }
      if (path.endsWith('/')) path += 'index.html';
      const file = Object.hasOwn(files, path) ? files[path] : null;
      if (!file) return new Response('Page not found', { status: 404 });
      const [type, data] = file;
      const headers = new Headers({
        'content-type': type,
        'cache-control': path.startsWith('/player/assets/') ? 'private, max-age=31536000, immutable' : 'private, no-cache',
        'x-content-type-options': 'nosniff',
      });
      if (/\.zip$/.test(path)) headers.set('content-disposition', `attachment; filename="${path.split('/').pop()}"`);
      if (request.method === 'HEAD') return new Response(null, { headers });
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Response(bytes, { headers });
    },
  };
}
