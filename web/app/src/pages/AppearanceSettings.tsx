import { Check } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { useLiquidGlass } from '@/lib/liquidGlass';
import { ACCENTS, PLAYER_STYLES, useAppearance } from '@/state/appearance';
import { Toggle } from './IntegrationSettings';
import { settingsUi } from './settingsStyles';

const label = (value: string) => value.replace(/-/g, ' ').replace(/^./, (s) => s.toUpperCase());

/** A row of choices with the picked one raised, as the app's segmented buttons. */
function Segmented<T extends string>({ title, value, options, onChange }: { title: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className={`${settingsUi.row} flex-wrap gap-3`}>
      <span>{title}</span>
      <div className="ot-segmented" role="radiogroup" aria-label={title}>
        {options.map(([v, name]) => (
          <button key={v} role="radio" aria-checked={value === v} onClick={() => onChange(v)}>{name}</button>
        ))}
      </div>
    </div>
  );
}

function GlassPreview() {
  const artwork = useRef<HTMLCanvasElement>(null);
  const lens = useLiquidGlass<HTMLDivElement>(22, 30);
  useLayoutEffect(() => {
    const canvas = artwork.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    const { width, height } = canvas;
    const wash = context.createLinearGradient(0, height, width, 0);
    wash.addColorStop(0, '#221947');
    wash.addColorStop(.35, '#6e2b99');
    wash.addColorStop(.66, '#d86b70');
    wash.addColorStop(1, '#f1bc69');
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);
    context.lineWidth = 2;
    context.strokeStyle = '#fff7e678';
    for (let x = -80; x < width + 64; x += 17) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x + 75, height);
      context.stroke();
    }
  }, []);
  return (
    <div className="ot-glass-preview" data-glass-preview aria-hidden="true">
      <canvas ref={artwork} width={800} height={144} data-glass-artwork />
      <div ref={lens} className="ot-glass-preview-lens glass-pill" />
    </div>
  );
}

export function AppearanceSettings() {
  const a = useAppearance();
  return (
    <>
      <section className={`${settingsUi.group} mb-3`} aria-label="Player glass">
        <Toggle
          label="Liquid Glass"
          detail="Bend the artwork behind the player and navigation. The preview shows the effect."
          checked={a.liquidGlass}
          onChange={(liquidGlass) => a.update({ liquidGlass })}
        />
        <GlassPreview />
      </section>
      <section className={settingsUi.group} aria-label="Appearance">
        <Segmented title="Theme" value={a.mode} options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} onChange={(mode) => a.update({ mode })} />
        <Toggle label="Pure black" detail="True black surfaces in dark mode." checked={a.pureBlack} onChange={(pureBlack) => a.update({ pureBlack })} />
        <Toggle label="Colors from artwork" detail="Let the playing song color Blynx Music." checked={a.artworkColors} onChange={(artworkColors) => a.update({ artworkColors })} />
        <fieldset className="ot-accent-picker hairline-[16px]">
          <legend>
            Accent color
            {a.artworkColors && <span>Picking one turns off colors from artwork.</span>}
          </legend>
          <div>
            {ACCENTS.map(([name, color]) => (
              <button key={color} aria-label={name} title={name} aria-pressed={!a.artworkColors && a.accent === color} onClick={() => a.update({ accent: color, artworkColors: false })} style={{ background: color }}>
                {!a.artworkColors && a.accent === color && <Check size={16} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
      <h3 className={settingsUi.sectionHeader}>Now Playing</h3>
      <section className={settingsUi.group} aria-label="Now Playing">
        <Segmented title="Background" value={a.playerBackground} options={[['mesh', 'Mesh'], ['gradient', 'Gradient'], ['echo', 'Echo glow']]} onChange={(playerBackground) => a.update({ playerBackground })} />
        <label className={settingsUi.controlRow}>
          Player style
          <select className={settingsUi.select} value={a.playerStyle} onChange={(e) => a.update({ playerStyle: e.target.value as typeof a.playerStyle })}>
            {PLAYER_STYLES.map((v) => <option key={v} value={v}>{label(v)}</option>)}
          </select>
        </label>
        <Toggle label="Animations" detail="Moving artwork, the player's waves and page motion. Your system's reduced-motion setting also applies." checked={a.motion} onChange={(motion) => a.update({ motion })} />
      </section>
      <p className={settingsUi.footer}>Saved in this browser. Wallpaper colors are in the Android app.</p>
    </>
  );
}
