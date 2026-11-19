import { useLayoutEffect, useSyncExternalStore } from 'react';
import { useArtworkColor } from '@/lib/artworkColor';
import { useAppearance } from '@/state/appearance';
import { isMobileBrowser } from '@/lib/platform';
import { prepareCustomCss, useCustomCss } from '@/state/customCss';
import { usePlayer } from '@/state/player';

const dark = window.matchMedia('(prefers-color-scheme: dark)');
export function Appearance() {
  const settings = useAppearance();
  const artwork = usePlayer(s => s.nowPlaying?.artworkUrl);
  const color = useArtworkColor(settings.artworkColors ? artwork : null);
  const systemDark = useSyncExternalStore(
    fn => { dark.addEventListener('change', fn); return () => dark.removeEventListener('change', fn); },
    () => dark.matches,
  );
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.appearance = settings.mode === 'system' ? (systemDark ? 'dark' : 'light') : settings.mode;
    root.dataset.black = String(settings.pureBlack);
    root.dataset.motion = String(settings.motion);
    root.dataset.playerStyle = settings.playerStyle;
    root.style.setProperty('--ot-seed', color?.background ?? settings.accent);
    root.style.setProperty('--ot-accent-choice', settings.accent);
  }, [settings.mode, settings.pureBlack, settings.motion, settings.playerStyle, settings.accent, systemDark, color]);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    style.setProperty('--liquid-opacity', `${settings.liquidGlassOpacity}%`);
    style.setProperty('--liquid-blur', `${settings.liquidGlassBlur}px`);
  }, [settings.liquidGlassOpacity, settings.liquidGlassBlur]);
  const customCss = useCustomCss((s) => s.source);
  useLayoutEffect(() => {
    if (!customCss || isMobileBrowser()) return;
    const style = document.createElement('style');
    try { style.textContent = prepareCustomCss(customCss); } catch { return; }
    document.head.append(style);
    return () => style.remove();
  }, [customCss]);
  return null;
}
