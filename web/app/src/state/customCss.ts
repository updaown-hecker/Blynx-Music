import { create } from 'zustand';

export const CUSTOM_CSS_KEY = 'blynx:custom-css';
export const CSS_LIMIT = 12_000;
export const EXAMPLE = '.ot-side { background-color: #301623; }\n.ot-home-heading { color: #c4c85e; }';

const targets = new Set(['.ot-side', '.ot-side-wordmark', '.ot-home-heading', '.ot-page', '.glass-pill', '.ot-mini']);
const properties = new Set(['color', 'background-color', 'border-color', 'border-radius', 'box-shadow', 'text-shadow', 'font-family', 'font-weight', 'letter-spacing', 'text-decoration-color']);

export function prepareCustomCss(source: string): string {
  if (source.length > CSS_LIMIT) throw new Error('Use a stylesheet under 12 KB.');
  if (/[\\@<>]/.test(source) || /\b(?:url|image-set|attr|var|expression)\s*\(/i.test(source)) {
    throw new Error('External assets, variables, and @ rules are unavailable in custom CSS.');
  }
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(source);
  const result = Array.from(sheet.cssRules).map((rule) => {
    if (rule.type !== CSSRule.STYLE_RULE) throw new Error('Use simple style rules.');
    const style = rule as CSSStyleRule;
    const selectors = style.selectorText.split(',').map((s) => s.trim());
    if (selectors.some((selector) => !targets.has(selector))) throw new Error('Use one of the supported selectors.');
    const declarations = Array.from(style.style).map((property) => {
      if (!properties.has(property) || style.style.getPropertyPriority(property)) {
        throw new Error(`“${property}” is unavailable in custom CSS.`);
      }
      return `${property}: ${style.style.getPropertyValue(property)};`;
    });
    if (!declarations.length) throw new Error('Use a supported visual property with a valid value.');
    return `${selectors.map((selector) => `#root [data-blynx-style] ${selector}`).join(', ')} { ${declarations.join(' ')} }`;
  });
  if (source.replace(/\/\*[\s\S]*?\*\//g, '').trim() && !result.length) throw new Error('Enter a valid style rule.');
  return result.join('\n');
}

function read(): string {
  try { return localStorage.getItem(CUSTOM_CSS_KEY) ?? ''; } catch { return ''; }
}

export const useCustomCss = create<{ source: string; update: (source: string) => void }>((set) => ({
  source: read(),
  update(source) {
    prepareCustomCss(source);
    if (source.trim()) localStorage.setItem(CUSTOM_CSS_KEY, source);
    else localStorage.removeItem(CUSTOM_CSS_KEY);
    set({ source });
  },
}));
