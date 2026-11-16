const endpoint = '/api/android-backup';
const status = document.querySelector('#status');
const signIn = document.querySelector('#sign-in');
const connect = document.querySelector('#connect');
const files = document.querySelector('#files');
const download = document.querySelector('#download');
const upload = document.querySelector('#upload');
const input = document.querySelector('#export-file');
const tokenHash = location.hash.slice(1);
const linking = /^[a-f0-9]{64}$/.test(tokenHash);
let revision = 0;
let ready = false;

async function refresh() {
  const response = await fetch(endpoint + '/meta', { cache: 'no-store' });
  if (response.status === 401) {
    status.textContent = 'Sign in to access your backups or connect your Android app.';
    signIn.href = '/signin-with-chatgpt?return_to=' + encodeURIComponent('/backup/' + (linking ? '#' + tokenHash : ''));
    signIn.hidden = false;
    return;
  }
  if (!response.ok) throw new Error('Backups are temporarily unavailable.');
  const meta = await response.json();
  revision = meta.revision;
  ready = true;
  status.textContent = linking
    ? 'Connect to ' + (meta.accountLabel || 'your signed-in account') + ' only if you opened this page from Blynx Music settings.'
    : meta.savedAt ? 'Last backup: ' + new Date(meta.savedAt).toLocaleString() : 'This account has no Android backup yet.';
  connect.hidden = !linking;
  files.hidden = linking;
  download.hidden = !revision;
}

connect.addEventListener('click', async () => {
  connect.disabled = true;
  try {
    const response = await fetch(endpoint + '/connect', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tokenHash }),
    });
    if (!response.ok) throw new Error('Could not connect. Open a new connection link in the Android app.');
    history.replaceState(null, '', '/backup/');
    connect.hidden = true;
    status.textContent = 'Connected. Return to Blynx Music on your Android device.';
  } catch (error) { status.textContent = error.message; }
  finally { connect.disabled = false; }
});

upload.addEventListener('click', () => input.click());
input.addEventListener('change', async () => {
  const file = input.files[0];
  input.value = '';
  if (!ready || !file) return;
  if (file.size > 6 * 1024 * 1024) { status.textContent = 'This file exceeds the backup size limit.'; return; }
  if (revision && !confirm('Replace the Android backup saved to this account?')) return;
  upload.disabled = true;
  try {
    let document;
    try { document = JSON.parse(await file.text()); }
    catch { throw new Error('Choose the JSON file exported by Blynx Music.'); }
    const response = await fetch(endpoint, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ revision, document }),
    });
    if (response.status === 409) { await refresh(); throw new Error('A newer backup arrived. Confirm again to replace it.'); }
    if (!response.ok) throw new Error('Could not save this Android export.');
    await refresh();
  } catch (error) { status.textContent = error.message; }
  finally { upload.disabled = false; }
});

refresh().catch(error => { status.textContent = error.message; });
