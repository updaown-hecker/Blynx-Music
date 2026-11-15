/** The release bridge is limited to the two Blynx Music player URLs. */
export const PRODUCTION_ORIGIN = 'https://music.blynx.vip';
export const SITE_ORIGINS = [
  PRODUCTION_ORIGIN,
  'https://blynx-music.updaown.chatgpt.site',
  ...(process.env.BLYNX_DEV_BRIDGE === '1' ? ['http://localhost:5173'] : []),
];

export function matchPatternsFor(origins: string[]): string[] {
  return origins.map(origin => origin.startsWith('http://localhost')
    ? 'http://localhost/*'
    : `${origin}/player/*`);
}
