// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { YtAuthStatus } from '@/extension/useYtAuth';
import { DesktopSignIn } from './DesktopSignIn';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  auth: { state: 'unavailable' } as YtAuthStatus,
  connect: vi.fn(),
}));

vi.mock('@/extension/useYtAuth', () => ({
  useYtAuth: () => state.auth,
  useSetConnected: () => ({ mutate: state.connect }),
  useRefreshYtAuth: () => ({ mutate: vi.fn() }),
}));

it('opens extension setup outside desktop mode, then offers Google sign-in and reconnects', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const render = () => act(async () => root.render(<DesktopSignIn />));
  try {
    await render();
    expect(host.querySelector('dialog')?.open).toBe(true);
    const setup = host.querySelector('a');
    expect(setup?.getAttribute('href')).toBe(import.meta.env.BASE_URL + '#/extension');
    expect(setup?.target).toBe('_blank');
    state.auth = { state: 'ready', auth: { browserSignedIn: false, connected: true, signedIn: false, accounts: [], active: null, problem: null } };
    await render();
    expect(new URL(host.querySelector('a')!.href).host).toBe('accounts.google.com');
    state.auth = { state: 'ready', auth: { ...state.auth.auth, browserSignedIn: true, connected: false } };
    await render();
    const connect = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('Connect account'));
    await act(async () => connect?.click());
    expect(state.connect).toHaveBeenCalledWith(true);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
