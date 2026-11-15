import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [staticRoot, entry] = process.argv.slice(2);
if (!staticRoot || !entry) throw new Error('Usage: node build.mjs <static root> <worker output>');
const types = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg',
  zip: 'application/zip', json: 'application/json', woff2: 'font/woff2', txt: 'text/plain; charset=utf-8',
};
const assets = {};
function walk(path = '') {
  for (const item of readdirSync(join(staticRoot, path), { withFileTypes: true })) {
    const name = join(path, item.name);
    if (item.isDirectory()) walk(name);
    else if (item.isFile()) assets[`/${name}`] = [types[name.split('.').pop()] || 'text/plain', readFileSync(join(staticRoot, name)).toString('base64')];
    else throw new Error(`Unsupported asset: ${name}`);
  }
}
walk();
for (const name of ['/index.html', '/player/index.html', '/player/downloads/extension.json']) {
  if (!assets[name]) throw new Error(`Missing asset: ${name}`);
}
mkdirSync(new URL('.', `file://${entry}`), { recursive: true });
const runtime = readFileSync(new URL('./worker.mjs', import.meta.url), 'utf8');
writeFileSync(entry, `${runtime}\nexport default createWorker(${JSON.stringify(assets)});\n`);
