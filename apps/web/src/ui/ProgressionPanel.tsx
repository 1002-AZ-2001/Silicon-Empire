import { ITEM_TYPES, MILESTONES, MILESTONE_IDS, TIERS } from '@silicon-empire/game-data';
import { milestoneAvailable, tierOpen } from '@silicon-empire/simulation';
import { ITEM_ART } from '../art/items';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { MilestoneId } from '@silicon-empire/game-data';
import type { World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

type MilestoneState = 'completed' | 'active' | 'available' | 'locked';

function stateOf(world: World, id: MilestoneId): MilestoneState {
  const { progress } = world;
  if (progress.completed.includes(id)) return 'completed';
  if (progress.active === id) return 'active';
  return milestoneAvailable(progress, id) ? 'available' : 'locked';
}

/** Parts of a milestone with what has already been delivered. */
export function MilestoneParts({ world, id }: { world: World; id: MilestoneId }) {
  const { t } = useI18n();
  const done = world.progress.completed.includes(id);
  const delivered = world.progress.delivered[id] ?? {};
  const cost = MILESTONES[id].cost;
  return (
    <ul className="milestone-parts" aria-label={t.progression.delivered}>
      {ITEM_TYPES.filter(item => (cost[item] ?? 0) > 0).map(item => {
        const required = cost[item] ?? 0;
        const count = done ? required : Math.min(delivered[item] ?? 0, required);
        return (
          <li key={item}>
            <img src={ITEM_ART[item]} alt="" />
            <span>{t.items[item]}</span>
            <strong>{count} / {required}</strong>
            <progress max={required} value={count} aria-hidden="true" />
          </li>
        );
      })}
    </ul>
  );
}

function MilestoneCard({ world, controls, id }: { world: World; controls: WorkshopControls; id: MilestoneId }) {
  const { t, money } = useI18n();
  const state = stateOf(world, id);
  const { unlocks, rewardCents, requires } = MILESTONES[id];
  const unmet = requires?.filter(required => !world.progress.completed.includes(required)) ?? [];
  const unlocked = [
    ...unlocks.machines.map(machine => t.machines[machine].name),
    ...unlocks.items.map(item => t.items[item]),
    ...(unlocks.models ?? []).map(model => t.production.models[model]),
  ];
  const label = {
    completed: t.progression.completed,
    active: t.progression.active,
    available: t.progression.available,
    locked: t.progression.lockedMilestone,
  }[state];
  return (
    <li className={`milestone milestone-${state}`} aria-label={t.progression.milestones[id]}>
      <header>
        <h4>{t.progression.milestones[id]}</h4>
        <span className="milestone-state">{label}</span>
      </header>
      {unmet.length > 0 && (
        <p className="tier-hint">{t.progression.requires(unmet.map(required => t.progression.milestones[required]).join(', '))}</p>
      )}
      <MilestoneParts world={world} id={id} />
      <dl className="milestone-rewards">
        <div><dt>{t.progression.unlocks}</dt><dd>{unlocked.length > 0 ? unlocked.join(', ') : t.progression.nothing}</dd></div>
        <div><dt>{t.progression.reward}</dt><dd>{money(rewardCents)}</dd></div>
      </dl>
      {state === 'available' && (
        <button type="button" className="button button-primary" onClick={() => controls.selectMilestone(id)}>
          {t.progression.choose}
        </button>
      )}
      {state === 'active' && (
        <button type="button" className="button" onClick={() => controls.selectMilestone(null)}>{t.progression.pause}</button>
      )}
    </li>
  );
}

export function ProgressionPanel({ world, controls, onClose }: {
  world: World;
  controls: WorkshopControls;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const hasHeadquarters = world.machines.some(machine => machine.type === 'headquarters');
  return (
    <Dialog
      wide
      title={t.progression.title}
      onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.progression.close}</button>}
    >
      <p>{t.progression.intro}</p>
      {!hasHeadquarters && <p className="text-error">{t.progression.needHq}</p>}
      <div className="tier-list">
        {TIERS.map(tier => {
          const open = tierOpen(world.progress, tier.tier);
          return (
            <section key={tier.tier} className={open ? 'tier' : 'tier tier-locked'} aria-label={t.progression.tier(tier.tier)}>
              <h3>{t.progression.tier(tier.tier)}</h3>
              <p className="tier-hint">
                {!open && tier.openedBy !== null ? t.progression.lockedTier(tier.openedBy)
                  : tier.sequential ? t.progression.sequential : t.progression.free}
              </p>
              <ul className="milestone-list">
                {MILESTONE_IDS.filter(id => MILESTONES[id].tier === tier.tier).map(id => (
                  <MilestoneCard key={id} world={world} controls={controls} id={id} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
