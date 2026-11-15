import { useEffect } from 'react';
import { create } from 'zustand';
import { useYtAuth } from '@/extension/useYtAuth';
import { CUSTOM_CSS_KEY, prepareCustomCss } from '@/state/customCss';

const fields = ['opentune:appearance', 'opentune:player', 'opentune:session', 'opentune:recent-searches', 'opentune:lyrics', 'opentune:jiosaavn', 'opentune:sidebar-collapsed', CUSTOM_CSS_KEY] as const;
type Field = typeof fields[number];
type State = Partial<Record<Field, string>>;
type Remote = { revision: number; state: State };
class SyncSignIn extends Error {}
type SyncStatus = 'Sign in to Blynx to sync' | 'Google account email unavailable' | 'Connect YouTube Music to sync' | 'Syncing…' | 'Synced' | 'Sync unavailable';
const PROFILE = 'blynx:sync-profile';
const ACK = 'blynx:sync-confirmed';
export const useCloudStatus = create<{ status: SyncStatus }>(() => ({ status: 'Connect YouTube Music to sync' }));
const setStatus = (status: SyncStatus) => useCloudStatus.setState({ status });

function lyricPreferences(value: string | null): Record<string, unknown> {
  try {
    const saved = JSON.parse(value ?? 'null');
    if (!saved || typeof saved !== 'object') return {};
    const { order, disabled, preferSyllables } = saved;
    return { order, disabled, preferSyllables };
  } catch { return {}; }
}

function local(): State {
  const state: State = {};
  for (const field of fields) {
    const value = localStorage.getItem(field);
    if (value === null) continue;
    state[field] = field === 'opentune:lyrics' ? JSON.stringify(lyricPreferences(value)) : value;
  }
  return state;
}

function restore(state: State, profile: string) {
  for (const field of fields) {
    const value = state[field];
    if (field === 'opentune:lyrics') {
      const old = localStorage.getItem(field);
      let key: unknown;
      try { key = JSON.parse(old ?? 'null')?.paxsenixKey; } catch { /* Invalid local settings. */ }
      if (value !== undefined || typeof key === 'string') {
        localStorage.setItem(field, JSON.stringify({ ...lyricPreferences(value ?? null), ...(typeof key === 'string' ? { paxsenixKey: key } : {}) }));
      } else localStorage.removeItem(field);
    } else if (value === undefined) {
      localStorage.removeItem(field);
    } else {
      if (field === CUSTOM_CSS_KEY) {
        try { prepareCustomCss(value); } catch { localStorage.removeItem(field); continue; }
      }
      localStorage.setItem(field, value);
    }
  }
  localStorage.setItem(PROFILE, profile);
}

async function digest(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(result), (b) => b.toString(16).padStart(2, '0')).join('');
}

function delta(previous: State, current: State): Partial<Record<Field, string | null>> {
  return Object.fromEntries(fields.filter((key) => previous[key] !== current[key]).map((key) => [key, current[key] ?? null]));
}
function merge(remote: State, changes: Partial<Record<Field, string | null>>): State {
  const state = { ...remote };
  for (const key of fields) {
    if (changes[key] === null) delete state[key];
    else if (changes[key] !== undefined) state[key] = changes[key];
  }
  return state;
}

export function useWebSync() {
  const status = useYtAuth();
  const auth = status.state === 'ready' && status.auth.signedIn ? status.auth : null;
  const channel = auth?.active;
  const email = auth?.accounts.find((account) => account.authUser === channel?.authUser)?.email?.trim().toLowerCase();
  const identity = email && channel ? `${email}\n${channel.brand ? channel.id.split(':').slice(1).join(':') : 'personal'}` : '';

  useEffect(() => {
    if (!identity) { setStatus(channel ? 'Google account email unavailable' : 'Connect YouTube Music to sync'); return; }
    const controller = new AbortController();
    const { signal } = controller;
    let timer: number | undefined;
    let busy = false;
    setStatus('Syncing…');

    async function start() {
      const profile = await digest(`blynx-web-sync-v1\n${identity}`);
      if (signal.aborted) return;
      const endpoint = `/api/blynx-sync/${profile}`;
      async function get(): Promise<Remote> {
        const response = await fetch(endpoint, { cache: 'no-store', signal });
        if (response.status === 401) throw new SyncSignIn();
        if (!response.ok) throw new Error('Sync unavailable');
        const saved: Remote = await response.json();
        if (saved.state[CUSTOM_CSS_KEY] !== undefined) {
          try { prepareCustomCss(saved.state[CUSTOM_CSS_KEY]); }
          catch { delete saved.state[CUSTOM_CSS_KEY]; }
        }
        return saved;
      }
      let remote = await get();
      if (signal.aborted) return;
      const current = local();
      const oldProfile = localStorage.getItem(PROFILE);
      const switching = !!oldProfile && oldProfile !== profile;
      let confirmed: { profile: string; state: State } | null = null;
      try { confirmed = JSON.parse(localStorage.getItem(ACK) ?? 'null'); } catch { /* Older session. */ }
      let last = confirmed?.profile === profile ? confirmed.state : remote.revision ? current : {};
      // Merge unsaved local changes with the latest cloud snapshot. A different account
      // never inherits the previous account’s queue or preferences.
      const wanted = switching ? remote.state : remote.revision ? merge(remote.state, delta(last, current)) : current;
      if (Object.keys(delta(current, wanted)).length) {
        restore(wanted, profile);
        localStorage.setItem(ACK, JSON.stringify({ profile, state: remote.state }));
        location.reload();
        return;
      }
      localStorage.setItem(PROFILE, profile);
      if (switching) last = current;
      let seed = !remote.revision && !switching;

      async function save() {
        if (busy || signal.aborted) return;
        busy = true;
        try {
          const current = local();
          const changes = delta(seed ? {} : last, current);
          if (Object.keys(changes).length) {
            for (let attempt = 0; attempt < 3; attempt++) {
              const state = merge(remote.state, changes);
              const response = await fetch(endpoint, {
                method: 'PUT', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ revision: remote.revision, state }), signal,
              });
              if (response.status === 409) { remote = await get(); continue; }
              if (response.status === 401) throw new SyncSignIn();
              if (!response.ok) throw new Error('Could not save');
              remote = await response.json();
              last = current;
              localStorage.setItem(ACK, JSON.stringify({ profile, state: last }));
              seed = false;
              setStatus('Synced');
              return;
            }
            throw new Error('Sync conflict');
          }
          setStatus('Synced');
        } catch (error) { if (!signal.aborted) setStatus(error instanceof SyncSignIn ? 'Sign in to Blynx to sync' : 'Sync unavailable'); }
        finally { busy = false; }
      }
      await save();
      if (!signal.aborted) timer = window.setInterval(() => { void save(); }, 5000);
    }

    void start().catch((error: unknown) => { if (!signal.aborted) setStatus(error instanceof SyncSignIn ? 'Sign in to Blynx to sync' : 'Sync unavailable'); });
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [identity, channel !== null && channel !== undefined]);
}
