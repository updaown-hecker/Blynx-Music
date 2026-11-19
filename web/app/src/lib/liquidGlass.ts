import { useEffect, useState } from 'react';
import { useAppearance } from '@/state/appearance';

/** Chromium can apply an SVG lens directly to the composed backdrop. */
function nativeBackdropRefraction(): boolean {
  const data = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData;
  const chromium = data?.brands?.some(({ brand }) => brand === 'Chromium') ||
    /(?:Chrome|Chromium)\//.test(navigator.userAgent);
  return !!chromium && CSS.supports('backdrop-filter', 'url("#blynx-lens")');
}

/**
 * The displacement map for a rounded rectangle [width]×[height] with corner
 * [radius], as RGBA pixels: red moves sampling across, green moves it down,
 * 128 is still. Within [bezel] of the edge the backdrop is sampled from further
 * in, along the edge's normal, on a circular profile: barely at the bezel's
 * inner side, steeply at the rim, as light through a rounded slab of glass.
 * Offsets are in units of the filter's largest shift.
 */
export function displacementPixels(width: number, height: number, radius: number, bezel: number): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(width * height * 4);
  const hx = width / 2;
  const hy = height / 2;
  const r = Math.max(0, Math.min(radius, hx, hy));
  const band = Math.max(1, Math.min(bezel, hx, hy));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x + 0.5 - hx;
      const py = y + 0.5 - hy;
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      let inside: number;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        // A corner: the normal points out from the corner's centre.
        const length = Math.hypot(qx, qy);
        inside = r - length;
        nx = (qx / length) * Math.sign(px);
        ny = (qy / length) * Math.sign(py);
      } else if (qx > qy) {
        inside = r - qx;
        nx = Math.sign(px);
      } else {
        inside = r - qy;
        ny = Math.sign(py);
      }
      const t = Math.min(1, Math.max(0, 1 - inside / band));
      const shift = 1 - Math.sqrt(1 - t * t);
      const i = (y * width + x) * 4;
      data[i] = Math.round(128 - nx * shift * 127);
      data[i + 1] = Math.round(128 - ny * shift * 127);
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
  }
  return data;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
let host: SVGSVGElement | null = null;
const filters = new Map<string, { id: string; node: SVGFilterElement; users: number }>();
let next = 0;

function svgHost(): SVGSVGElement {
  if (host?.isConnected) return host;
  host = document.createElementNS(SVG_NS, 'svg');
  // Not display:none, which would stop the filters being found at all.
  host.setAttribute('width', '0');
  host.setAttribute('height', '0');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.pointerEvents = 'none';
  document.body.append(host);
  return host;
}

function mapUrl(width: number, height: number, radius: number, bezel: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return '';
  context.putImageData(new ImageData(displacementPixels(width, height, radius, bezel), width, height), 0, 0);
  return canvas.toDataURL();
}

function el<K extends keyof SVGElementTagNameMap>(name: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}

/**
 * One filter per size and shape, shared by everything that size (all of a
 * page's shelf arrows use one) and removed when the last user lets go.
 */
function acquire(width: number, height: number, radius: number, bezel: number, depth: number): string {
  const key = `${width}x${height}r${radius}b${bezel}d${depth}`;
  const known = filters.get(key);
  if (known) {
    known.users++;
    return key;
  }
  const id = `ot-liquid-${next++}`;
  const box = { x: 0, y: 0, width, height };
  const filter = el('filter', { id, ...box, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
  const image = el('feImage', { ...box, result: 'map', preserveAspectRatio: 'none' });
  image.setAttribute('href', mapUrl(width, height, radius, bezel));
  filter.append(image);
  filter.append(el('feDisplacementMap', {
    in: 'SourceGraphic', in2: 'map', scale: depth * 2,
    xChannelSelector: 'R', yChannelSelector: 'G',
  }));
  svgHost().append(filter);
  filters.set(key, { id, node: filter, users: 1 });
  return key;
}

function release(key: string) {
  const known = filters.get(key);
  if (!known || --known.users > 0) return;
  known.node.remove();
  filters.delete(key);
}

/**
 * Draw only artwork intersecting the lens. Firefox and Safari can distort
 * a canvas through an SVG filter even when SVG backdrop-filter is unavailable.
 */
function mirrorArtwork(node: HTMLElement, canvas: HTMLCanvasElement, source: HTMLElement): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const refreshSources = () => source.querySelectorAll<HTMLImageElement | HTMLCanvasElement>('img, canvas[data-glass-artwork]');
  let artwork = refreshSources();
  let frame = 0;
  const draw = () => {
    frame = 0;
    const bounds = node.getBoundingClientRect();
    const scene = source.getBoundingClientRect();
    const { width, height } = canvas;
    if (!bounds.width || !bounds.height || !width || !height) return;
    context.setTransform(width / bounds.width, 0, 0, height / bounds.height, 0, 0);
    context.clearRect(0, 0, bounds.width, bounds.height);
    for (const item of artwork) {
      if (node.contains(item)) continue;
      const image = item instanceof HTMLImageElement;
      if (image && (!item.complete || !item.naturalWidth)) continue;
      const rect = item.getBoundingClientRect();
      if (!rect.width || !rect.height ||
        Math.max(rect.left, scene.left, bounds.left) >= Math.min(rect.right, scene.right, bounds.right) ||
        Math.max(rect.top, scene.top, bounds.top) >= Math.min(rect.bottom, scene.bottom, bounds.bottom)) continue;

      const x = rect.left - bounds.left;
      const y = rect.top - bounds.top;
      const style = getComputedStyle(item);
      const radius = Math.min(Number.parseFloat(style.borderTopLeftRadius) || 0, rect.width / 2, rect.height / 2);
      context.save();
      context.beginPath();
      context.rect(scene.left - bounds.left, scene.top - bounds.top, scene.width, scene.height);
      context.clip();
      context.beginPath();
      context.roundRect(x, y, rect.width, rect.height, radius);
      context.clip();
      if (image && style.objectFit === 'cover') {
        const scale = Math.max(rect.width / item.naturalWidth, rect.height / item.naturalHeight);
        const w = item.naturalWidth * scale;
        const h = item.naturalHeight * scale;
        context.drawImage(item, x + (rect.width - w) / 2, y + (rect.height - h) / 2, w, h);
      } else {
        context.drawImage(item, x, y, rect.width, rect.height);
      }
      context.restore();
    }
  };
  const queue = () => { if (!frame) frame = requestAnimationFrame(draw); };
  const observer = new MutationObserver(() => { artwork = refreshSources(); queue(); });
  observer.observe(source, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  const resize = new ResizeObserver(queue);
  resize.observe(node);
  resize.observe(source);
  source.addEventListener('scroll', queue, { capture: true, passive: true });
  source.addEventListener('load', queue, true);
  node.addEventListener('transitionend', queue);
  queue();
  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    resize.disconnect();
    source.removeEventListener('scroll', queue, true);
    source.removeEventListener('load', queue, true);
    node.removeEventListener('transitionend', queue);
  };
}

/** Keep the optics on a separate layer so the text and buttons remain crisp. */
export function useLiquidGlass<T extends HTMLElement>(bezel = 22, depth = 22): (node: T | null) => void {
  const [node, setNode] = useState<T | null>(null);
  const enabled = useAppearance((s) => s.liquidGlass);
  useEffect(() => {
    if (!node || !enabled) return;
    const native = nativeBackdropRefraction();
    const reduced = matchMedia('(prefers-reduced-transparency: reduce)');
    let held: string | null = null;
    let canvas: HTMLCanvasElement | null = null;
    let stopMirror: (() => void) | undefined;
    const clear = () => {
      stopMirror?.();
      stopMirror = undefined;
      canvas?.remove();
      canvas = null;
      if (held) release(held);
      held = null;
      node.style.removeProperty('--liquid-filter');
      node.style.removeProperty('--liquid-radius');
      delete node.dataset.liquid;
    };
    const apply = () => {
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      if (reduced.matches || !width || !height) { clear(); return; }
      const radius = Math.round(Math.min(Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0, width / 2, height / 2));
      const source = !native && node.classList.contains('glass-pill')
        ? node.closest<HTMLElement>('[data-glass-preview]') ?? document.getElementById('scrollable-page')
        : null;
      if (native || source) {
        const key = acquire(width, height, radius, bezel, depth);
        if (held) release(held);
        held = key;
        node.style.setProperty('--liquid-filter', `url(#${filters.get(key)!.id})`);
      }
      if (source) {
        node.style.setProperty('--liquid-radius', `${radius}px`);
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.className = 'ot-glass-artwork';
          canvas.setAttribute('aria-hidden', 'true');
          node.append(canvas);
          stopMirror = mirrorArtwork(node, canvas, source);
        }
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
      }
      node.dataset.liquid = native ? 'native' : source ? 'mirror' : 'edge';
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    reduced.addEventListener('change', apply);
    return () => {
      observer.disconnect();
      reduced.removeEventListener('change', apply);
      clear();
    };
  }, [node, enabled, bezel, depth]);
  return setNode;
}
