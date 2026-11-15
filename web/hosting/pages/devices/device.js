'use strict';

const route = document.body.dataset.route;
const fragment = location.hash.slice(1);
const message = document.getElementById('message');
const app = document.getElementById('open-app');
const android = /Android/i.test(navigator.userAgent);

function showAndroidLink(path, scheme) {
  app.href = `intent://${path}#Intent;scheme=${scheme};package=vip.blynx.music;end`;
  app.hidden = false;
}

if (route === 'together') {
  const code = (new URLSearchParams(fragment).get('code') || '').toUpperCase();
  if (/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/.test(code)) {
    message.textContent = 'A friend invited you to a Blynx Music room.';
    const codeLabel = document.getElementById('code');
    codeLabel.textContent = code.match(/.{4}/g).join('–');
    codeLabel.hidden = false;
    const web = document.getElementById('open-web');
    web.href = `/player/#/invite/${code}`;
    web.textContent = 'Join in browser';
    // Installed versions also understand this compatibility scheme.
    if (android) showAndroidLink(`together/${code}`, 'opentune');
  } else if (fragment) {
    message.textContent = 'This room link is invalid. Ask your friend to share a fresh link or enter the room code in the web player.';
  }
} else {
  // Pairing offers are private, short-lived fragments. Remove them from the address bar.
  if (fragment) history.replaceState(null, '', location.pathname);
  const limit = route === 'pair' ? 512 : 1024;
  if (!/^[A-Za-z0-9_-]+$/.test(fragment) || fragment.length < 40 || fragment.length > limit) {
    if (fragment) message.textContent = 'This pairing link is invalid. Request a new QR code on the other device.';
  } else if (android && route === 'pair') {
    message.textContent = 'Open Blynx Music to review and approve the connection.';
    // Keep the offer in the fragment and target only Blynx Music.
    showAndroidLink(`pair/#${fragment}`, 'opentune');
  }
}
