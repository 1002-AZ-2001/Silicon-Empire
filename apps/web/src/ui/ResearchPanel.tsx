import { ITEM_TYPES, RESEARCH, RESEARCH_IDS, TIME } from '@silicon-empire/game-data';
import { researchAvailable } from '@silicon-empire/simulation';
import { ITEM_ART } from '../art/items';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { ResearchEffect, ResearchId } from '@silicon-empire/game-data';
import type { World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';
import type { Messages } from '../i18n';

type ProjectState = 'completed' | 'analysing' | 'active' | 'available' | 'locked';

function stateOf(world: World, id: ResearchId): ProjectState {
  const { research, progress } = world;
  if (research.completed.includes(id)) return 'completed';
  if (research.analysing?.id === id) return 'analysing';
  if (research.active === id) return 'active';
  return researchAvailable(progress, research, id) ? 'available' : 'locked';
}

const seconds = (ticks: number) => Math.ceil(ticks / TIME.ticksPerSecond);

export function effectLabel(t: Messages, effect: ResearchEffect): string {
  switch (effect.kind) {
    case 'upgrade': return t.research.upgradeEffect(t.machines[effect.machine].name);
    case 'machine': return t.research.machineEffect(t.machines[effect.machine].name);
    case 'dock-capacity': return t.research.dockEffect(effect.capacity);
    case 'rejection': return t.research.rejectionEffect(effect.every);
  }
}

/** Parts of a project with what has already reached a laboratory. */
export function ResearchParts({ world, id }: { world: World; id: ResearchId }) {
  const { t } = useI18n();
  const { research } = world;
  const arrived = research.completed.includes(id) || research.analysing?.id === id;
  const delivered = research.delivered[id] ?? {};
  const cost = RESEARCH[id].cost;
  return (
    <ul className="milestone-parts" aria-label={t.progression.delivered}>
      {ITEM_TYPES.filter(item => (cost[item] ?? 0) > 0).map(item => {
        const required = cost[item] ?? 0;
        const count = arrived ? required : Math.min(delivered[item] ?? 0, required);
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

/** Remaining analysis time of the running project. */
export function AnalysisProgress({ world }: { world: World }) {
  const { t } = useI18n();
  const analysing = world.research.analysing;
  if (!analysing) return null;
  const total = RESEARCH[analysing.id].ticks;
  return (
    <p className="analysis-progress">
      <progress max={total} value={total - analysing.remaining} aria-label={t.research.analysing} />
      {t.research.remaining(seconds(analysing.remaining))}
    </p>
  );
}

function ProjectCard({ world, controls, id }: { world: World; controls: WorkshopControls; id: ResearchId }) {
  const { t } = useI18n();
  const state = stateOf(world, id);
  const { requires, effect, ticks } = RESEARCH[id];
  const prerequisites = [
    ...(requires.milestones ?? []).map(milestone => t.progression.milestones[milestone]),
    ...(requires.research ?? []).map(project => t.research.projects[project]),
  ];
  const label = {
    completed: t.research.completed,
    analysing: t.research.analysing,
    active: t.research.active,
    available: t.research.available,
    locked: t.research.locked,
  }[state];
  return (
    <li className={`milestone milestone-${state === 'analysing' ? 'active' : state}`} aria-label={t.research.projects[id]}>
      <header>
        <h4>{t.research.projects[id]}</h4>
        <span className="milestone-state">{label}</span>
      </header>
      <ResearchParts world={world} id={id} />
      {state === 'analysing' && <AnalysisProgress world={world} />}
      <dl className="milestone-rewards">
        <div><dt>{t.research.effect}</dt><dd>{effectLabel(t, effect)}</dd></div>
        <div><dt>{t.research.duration}</dt><dd>{t.research.seconds(seconds(ticks))}</dd></div>
        {prerequisites.length > 0 && <div><dt>{t.research.requires}</dt><dd>{prerequisites.join(', ')}</dd></div>}
      </dl>
      {state === 'available' && (
        <button type="button" className="button button-primary" onClick={() => controls.selectResearch(id)}>
          {t.research.choose}
        </button>
      )}
      {state === 'active' && (
        <button type="button" className="button" onClick={() => controls.selectResearch(null)}>{t.research.pause}</button>
      )}
    </li>
  );
}

export function ResearchPanel({ world, controls, onClose }: {
  world: World;
  controls: WorkshopControls;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const hasLab = world.machines.some(machine => machine.type === 'lab');
  return (
    <Dialog
      wide
      title={t.research.title}
      onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.research.close}</button>}
    >
      <p>{t.research.intro}</p>
      {world.progress.sandbox && <p className="tier-hint">{t.research.sandbox}</p>}
      {!hasLab && <p className="text-error">{t.research.needLab}</p>}
      <ul className="milestone-list research-list">
        {RESEARCH_IDS.map(id => <ProjectCard key={id} world={world} controls={controls} id={id} />)}
      </ul>
    </Dialog>
  );
}
