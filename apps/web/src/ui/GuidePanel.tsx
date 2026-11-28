import { PRODUCT_MODELS, recipeOf } from '@silicon-empire/game-data';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import { chipsOf, eraOf } from '@silicon-empire/simulation';
import type { World } from '@silicon-empire/simulation';

export function GuidePanel({ world, onClose }: { world: World; onClose: () => void }) {
  const { t } = useI18n();
  const boughtParts = world.ledger.purchaseSpentCents > 0;
  const packagingStarted = PRODUCT_MODELS.some(model => {
    const recipe = recipeOf('packager', model, world.design, eraOf(world.progress), chipsOf(world.progress));
    return recipe && (world.ledger.produced[recipe.output] ?? 0) > 0;
  });
  const sold = world.sales.completed.length > 0;
  const steps = [
    { key: 'dock', done: boughtParts || world.machines.some(machine => machine.type === 'receiving') },
    { key: 'parts', done: boughtParts },
    { key: 'unlock', done: world.progress.sandbox || world.progress.completed.includes('packaging') },
    { key: 'packaging', done: packagingStarted },
    { key: 'order', done: sold || world.sales.active !== null },
    { key: 'sale', done: sold },
  ] as const;
  const next = steps.findIndex(step => !step.done);

  return (
    <Dialog title={t.guide.title} onDismiss={onClose} actions={
      <button type="button" className="button" onClick={onClose}>{t.progression.close}</button>
    }>
      <p>{t.guide.intro}</p>
      <ol className="guide-steps">
        {steps.map(({ key, done }, index) => (
          <li key={key} aria-current={index === next ? 'step' : undefined}>
            <div className="guide-step-label">
              <strong>{t.guide.steps[key].title}</strong>
              {done && <small>{t.progression.completed}</small>}
            </div>
            <p>{t.guide.steps[key].hint}</p>
          </li>
        ))}
      </ol>
    </Dialog>
  );
}
