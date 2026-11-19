// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import { appearanceOf, DEFAULT_APPEARANCE, useAppearance } from './appearance';
it('recovers invalid persisted choices without losing valid preferences', () => {
  expect(appearanceOf(null)).toEqual(DEFAULT_APPEARANCE);
  expect(appearanceOf({ mode: 'invalid', accent: 'url(example)', pureBlack: false, playerStyle: 'vinyl' }))
    .toEqual({ ...DEFAULT_APPEARANCE, pureBlack: false, playerStyle: 'vinyl' });
});
it('saves appearance changes independently and round-trips across reloads', () => {
  useAppearance.getState().update({ mode: 'dark', playerStyle: 'polaroid', motion: false });
  const saved = appearanceOf(JSON.parse(localStorage.getItem('opentune:appearance')!));
  expect(saved).toMatchObject({ mode: 'dark', playerStyle: 'polaroid', motion: false });
  expect(saved.accent).toBe(DEFAULT_APPEARANCE.accent);
});
it('retains zero and clamps saved Liquid Glass settings to the slider ranges', () => {
  expect(appearanceOf({ liquidGlassOpacity: 0, liquidGlassBlur: 0 }))
    .toMatchObject({ liquidGlassOpacity: 0, liquidGlassBlur: 0 });
  expect(appearanceOf({ liquidGlassOpacity: 120, liquidGlassBlur: -5 }))
    .toMatchObject({ liquidGlassOpacity: 100, liquidGlassBlur: 0 });
  expect(appearanceOf({ liquidGlassOpacity: '70', liquidGlassBlur: Infinity }))
    .toEqual(DEFAULT_APPEARANCE);
  useAppearance.getState().update({ liquidGlassOpacity: 65, liquidGlassBlur: 12 });
  expect(appearanceOf(JSON.parse(localStorage.getItem('opentune:appearance')!)))
    .toMatchObject({ liquidGlassOpacity: 65, liquidGlassBlur: 12 });
});
