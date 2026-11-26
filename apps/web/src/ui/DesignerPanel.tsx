import { DEFAULT_DESIGN, DESIGN_OPTIONS, ITEM_TYPES, designParts, designPower, saleOffer } from '@silicon-empire/game-data';
import { useState } from 'react';
import { orderableItems } from '@silicon-empire/simulation';
import { ITEM_ART } from '../art/items';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { CommandError, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

export function DesignerPanel({ world, controls, onClose }: { world: World; controls: WorkshopControls; onClose: () => void }) {
  const { t, money } = useI18n();
  const [spec, setSpec] = useState(world.design?.spec ?? DEFAULT_DESIGN);
  const [error, setError] = useState<CommandError | null>(null);
  const purchasable = orderableItems(world.progress);
  const power = designPower(spec);
  const enoughPower = power.available >= power.required;
  const parts = designParts(spec);
  const preview = saleOffer('custom', { revision: 1, spec });
  const fields = ['memory', 'storage', 'graphics', 'power'] as const;

  return (
    <Dialog wide title={t.design.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.progression.close}</button>}
    >
      {world.design && <p role="status">{t.design.revision} {world.design.revision} · {world.design.spec.name}</p>}
      <form className="order-form" onSubmit={event => {
        event.preventDefault();
        setError(controls.publishDesign(spec));
      }}>
        <label>
          <span>{t.design.name}</span>
          <input required maxLength={36} value={spec.name} onChange={event => {
            setSpec({ ...spec, name: event.target.value });
            setError(null);
          }} />
        </label>
        {fields.map(field => (
          <label key={field}>
            <span>{t.design[field]}</span>
            <select aria-label={t.design[field]} value={spec[field]} onChange={event => {
              setSpec({ ...spec, [field]: event.target.value });
              setError(null);
            }}>
              {DESIGN_OPTIONS[field].map(option => (
                <option key={option} value={option} disabled={option !== 'integrated' && !purchasable.has(option)}>
                  {option === 'integrated' ? t.design.integrated : t.items[option]}
                </option>
              ))}
            </select>
          </label>
        ))}
        <dl className="machine-stats">
          <div><dt>{t.design.watts}</dt><dd className={enoughPower ? undefined : 'text-error'}>{power.required} / {power.available} W</dd></div>
          {preview && <div><dt>{t.trade.material}</dt><dd>{money(preview.unitMaterialCents)}</dd></div>}
        </dl>
        <ul className="stock-list" aria-label={t.production.recipe}>
          {ITEM_TYPES.filter(item => parts[item]).map(item => (
            <li key={item}><img src={ITEM_ART[item]} alt="" /><span>{t.items[item]}</span><strong>{parts[item]}</strong></li>
          ))}
        </ul>
        {(!enoughPower || error) && <p role="alert" className="text-error">{t.errors[!enoughPower ? 'design-power' : error ?? 'design-invalid']}</p>}
        <button type="submit" className="button button-primary" disabled={!enoughPower || !spec.name.trim()}>{t.design.publish}</button>
      </form>
    </Dialog>
  );
}
