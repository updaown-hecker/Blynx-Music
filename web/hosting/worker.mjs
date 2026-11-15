const syncPath = /^\/api\/blynx-sync\/([a-f0-9]{64})$/;
const limits = {
  'opentune:appearance': 2000, 'opentune:player': 2000, 'opentune:session': 300000,
  'opentune:recent-searches': 8000, 'opentune:lyrics': 4000, 'opentune:jiosaavn': 5,
  'opentune:sidebar-collapsed': 1, 'blynx:custom-css': 12000,
};
const json = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store' } });
const empty = () => ({ revision: 0, state: {} });

async function readJson(request) {
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
      if (size > 370000) throw new Error('Body too large');
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

export function createWorker(files) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      const profile = syncPath.exec(url.pathname)?.[1];
      if (profile) {
        try { return await sync(request, url, env.DB, profile); }
        catch { return json({ error: 'Sync temporarily unavailable' }, 503); }
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405 });
      if (['/player', '/together', '/pair', '/remote', '/devices'].includes(url.pathname)) {
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
