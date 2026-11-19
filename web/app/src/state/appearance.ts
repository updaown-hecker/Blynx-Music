import { create } from 'zustand';

export const ACCENTS = [
  ['Red', '#e53935'], ['Amber', '#ff6f00'], ['Yellow', '#fdd835'], ['Green', '#43a047'],
  ['Teal', '#00897b'], ['Sky', '#039be5'], ['Indigo', '#3949ab'], ['Purple', '#8e24aa'],
  ['Pink', '#d81b60'], ['Brown', '#6d4c41'],
] as const;
export const PLAYER_STYLES = ['classic', 'vinyl', 'lyrics-first', 'minimal', 'cassette', 'halo', 'polaroid'] as const;
export const MAX_LIQUID_GLASS_BLUR = 24;

export interface Appearance {
  mode: 'system' | 'light' | 'dark';
  accent: string;
  pureBlack: boolean;
  artworkColors: boolean;
  playerBackground: 'mesh' | 'gradient' | 'echo';
  playerStyle: typeof PLAYER_STYLES[number];
  motion: boolean;
  /** Enable refraction on floating player surfaces. */
  liquidGlass: boolean;
  liquidGlassOpacity: number;
  liquidGlassBlur: number;
}
export const DEFAULT_APPEARANCE: Appearance = {
  mode: 'system', accent: '#e53935', pureBlack: true, artworkColors: true,
  playerBackground: 'mesh', playerStyle: 'classic', motion: true, liquidGlass: true,
  liquidGlassOpacity: 26, liquidGlassBlur: 2,
};

function glassAmount(value: unknown, fallback: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(0, Math.round(value)))
    : fallback;
}

export function appearanceOf(value: unknown): Appearance {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Appearance>;
  return {
    mode: ['system', 'light', 'dark'].includes(v.mode ?? '') ? v.mode! : DEFAULT_APPEARANCE.mode,
    accent: ACCENTS.some(([, color]) => color === v.accent) ? v.accent! : DEFAULT_APPEARANCE.accent,
    pureBlack: typeof v.pureBlack === 'boolean' ? v.pureBlack : true,
    artworkColors: typeof v.artworkColors === 'boolean' ? v.artworkColors : true,
    playerBackground: ['mesh', 'gradient', 'echo'].includes(v.playerBackground ?? '') ? v.playerBackground! : 'mesh',
    playerStyle: PLAYER_STYLES.includes(v.playerStyle!) ? v.playerStyle! : 'classic',
    motion: typeof v.motion === 'boolean' ? v.motion : true,
    liquidGlass: typeof v.liquidGlass === 'boolean' ? v.liquidGlass : true,
    liquidGlassOpacity: glassAmount(v.liquidGlassOpacity, DEFAULT_APPEARANCE.liquidGlassOpacity, 100),
    liquidGlassBlur: glassAmount(v.liquidGlassBlur, DEFAULT_APPEARANCE.liquidGlassBlur, MAX_LIQUID_GLASS_BLUR),
  };
}
const KEY = 'opentune:appearance';
function read(): Appearance {
  try { return appearanceOf(JSON.parse(localStorage.getItem(KEY) ?? '{}')); } catch { return { ...DEFAULT_APPEARANCE }; }
}
export const useAppearance = create<Appearance & { update: (change: Partial<Appearance>) => void }>((set, get) => ({
  ...read(),
  update(change) {
    const next = appearanceOf({ ...get(), ...change });
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* Still applies for this session. */ }
    set(next);
  },
}));
