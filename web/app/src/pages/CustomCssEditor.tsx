import { useState } from 'react';
import { CSS_LIMIT, EXAMPLE, useCustomCss } from '@/state/customCss';
import { settingsUi } from './settingsStyles';

export function CustomCssEditor() {
  const active = useCustomCss((s) => s.source);
  const update = useCustomCss((s) => s.update);
  const [draft, setDraft] = useState(active);
  const [status, setStatus] = useState('');
  function apply(css: string) {
    try {
      update(css);
      setDraft(css);
      setStatus(css.trim() ? 'Custom CSS applied.' : 'Default styles restored.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Custom CSS could not be applied.');
    }
  }
  return (
    <section className={settingsUi.group} aria-label="Custom CSS">
      <div className="flex flex-col gap-3 px-4 py-4">
        <p className="type-body text-secondary">Change colors, corners, shadows, and typography. Supported selectors are <code>.ot-side</code>, <code>.ot-side-wordmark</code>, <code>.ot-home-heading</code>, <code>.ot-page</code>, <code>.glass-pill</code>, and <code>.ot-mini</code>.</p>
        <label className="flex flex-col gap-1 type-body-emphasized">
          Stylesheet
          <textarea className="ot-field min-h-35 font-mono" spellCheck={false} maxLength={CSS_LIMIT} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={EXAMPLE} />
        </label>
        <div className="flex flex-wrap items-center gap-3 type-body-emphasized">
          <button type="button" className="rounded-pill bg-key-bg px-4 py-2 text-white" onClick={() => apply(draft)}>Apply CSS</button>
          <label className="cursor-pointer rounded-pill px-3 py-2 text-key hover:bg-quinary">
            Open CSS file
            <input type="file" className="sr-only" accept=".css,text/css" onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              if (file.size > CSS_LIMIT) { setStatus('Use a stylesheet under 12 KB.'); return; }
              try { setDraft(await file.text()); setStatus('File opened in the editor.'); }
              catch { setStatus('The file could not be read.'); }
            }} />
          </label>
          <button type="button" className="px-3 py-2 text-key" onClick={() => apply('')}>Reset</button>
        </div>
        <p className="type-callout text-secondary" role="status">{status}</p>
      </div>
    </section>
  );
}
