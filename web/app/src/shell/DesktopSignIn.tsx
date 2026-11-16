import { useEffect, useRef, useState } from 'react';
import { useRefreshYtAuth, useSetConnected, useYtAuth } from '@/extension/useYtAuth';

const youtubeSignIn = 'https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fmusic.youtube.com%2F';
const primary = 'inline-flex min-h-11 items-center justify-center rounded-pill bg-key-bg px-5 type-body-emphasized text-white hover:brightness-110 disabled:opacity-50';

export function DesktopSignIn() {
  const status = useYtAuth();
  const connect = useSetConnected();
  const refresh = useRefreshYtAuth();
  const [dismissed, setDismissed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const auth = status.state === 'ready' ? status.auth : null;
  const open = !dismissed && status.state !== 'checking' && !(auth?.signedIn && auth.active);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    element.showModal();
    return () => element.close();
  }, [open]);

  if (!open) return null;

  return (
    <dialog
      ref={dialog}
      aria-labelledby="desktop-sign-in-title"
      onCancel={() => setDismissed(true)}
      className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-[440px] rounded-[24px] bg-page p-6 text-primary shadow-glass backdrop:bg-scrim sm:p-8"
    >
      <h2 id="desktop-sign-in-title" className="type-title-2-emphasized">Connect YouTube Music</h2>
      <p className="mt-2 type-body text-secondary">
        {status.state === 'unavailable'
          ? 'Set up the Blynx Music extension in this browser profile to sign in and play music.'
          : auth?.browserSignedIn
            ? 'Use the YouTube Music account already signed in to this browser.'
            : 'Sign in on Google’s page, then return here to load your YouTube Music library.'}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {status.state === 'unavailable' ? (
          <a className={primary} href={`${import.meta.env.BASE_URL}#/extension`} target="_blank" rel="noopener noreferrer">Set up extension</a>
        ) : auth?.browserSignedIn && !auth.connected ? (
          <button className={primary} type="button" disabled={connect.isPending} onClick={() => connect.mutate(true)}>
            {connect.isPending ? 'Connecting…' : 'Connect account'}
          </button>
        ) : auth?.browserSignedIn ? (
          <button className={primary} type="button" disabled={refresh.isPending} onClick={() => refresh.mutate()}>
            {refresh.isPending ? 'Checking…' : 'Retry connection'}
          </button>
        ) : (
          <a className={primary} href={youtubeSignIn} target="_blank" rel="noopener noreferrer">Sign in on Google</a>
        )}
        <button className="min-h-11 rounded-pill px-4 type-body-emphasized text-key hover:bg-quaternary" type="button" onClick={() => setDismissed(true)}>
          Continue browsing
        </button>
      </div>
      {(connect.isError || refresh.isError || auth?.problem) && (
        <p role="status" className="mt-3 type-callout text-secondary">
          {auth?.problem ?? 'The account could not connect. Try again after checking the extension.'}
        </p>
      )}
    </dialog>
  );
}
