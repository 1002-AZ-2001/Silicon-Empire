import { MACHINES, RESEARCH, RESEARCH_IDS, UPGRADE_COSTS } from '@silicon-empire/game-data';
import type { ItemType, MachineType, Recipe, ResearchId, UpgradeLevel } from '@silicon-empire/game-data';
import type { Inventory } from './inventory';
import type { Progress } from './progress';

/**
 * Research at the laboratory. One project receives parts at a time; when they have all arrived it is
 * analysed for its duration, which only advances while a laboratory stands. A new project can collect
 * parts during an analysis and starts its own analysis afterwards.
 */
export interface ResearchState {
  readonly active: ResearchId | null;
  /** Parts delivered to each unfinished project. Kept when the active project changes. */
  readonly delivered: Readonly<Partial<Record<ResearchId, Inventory>>>;
  readonly analysing: { readonly id: ResearchId; readonly remaining: number } | null;
  /** Finished projects in completion order. */
  readonly completed: readonly ResearchId[];
}

export const NO_RESEARCH: ResearchState = { active: null, delivered: {}, analysing: null, completed: [] };

/**
 * Finished projects. Sandbox workshops already have every building and Mk2 upgrade, but numeric bonuses
 * (dock capacity, rejection rate) still come from research there, without milestone prerequisites.
 */
export function researched(_progress: Progress, research: ResearchState, id: ResearchId): boolean {
  return research.completed.includes(id);
}

export function researchAvailable(progress: Progress, research: ResearchState, id: ResearchId): boolean {
  if (research.completed.includes(id) || research.analysing?.id === id) return false;
  const { milestones = [], research: projects = [] } = RESEARCH[id].requires;
  return (progress.sandbox || milestones.every(milestone => progress.completed.includes(milestone))) &&
    projects.every(project => research.completed.includes(project));
}

/** Units of `item` the active project still needs. */
export function researchStillNeeded(research: ResearchState, item: ItemType): number {
  if (!research.active) return 0;
  const required = RESEARCH[research.active].cost[item] ?? 0;
  return Math.max(0, required - (research.delivered[research.active]?.[item] ?? 0));
}

export function researchPartsDone(research: ResearchState, id: ResearchId): boolean {
  const delivered = research.delivered[id] ?? {};
  return Object.entries(RESEARCH[id].cost).every(([item, count]) => (delivered[item as ItemType] ?? 0) >= (count ?? 0));
}

/** Buildings unlocked by finished research. */
export function researchMachines(progress: Progress, research: ResearchState): MachineType[] {
  return RESEARCH_IDS.flatMap(id => {
    const { effect } = RESEARCH[id];
    return effect.kind === 'machine' && researched(progress, research, id) ? [effect.machine] : [];
  });
}

/**
 * Whether a machine can be upgraded to `level`. Sandbox: always. Career: the automation licence for Mk2,
 * robotics for Mk3. Classic: a research project per machine for Mk2, advanced automation for Mk3.
 */
export function upgradeUnlocked(progress: Progress, research: ResearchState, machine: MachineType, level: UpgradeLevel = 2): boolean {
  if (!UPGRADE_COSTS[machine]) return false;
  if (progress.sandbox) return true;
  if (progress.career) return progress.career.technologies.includes(level === 2 ? 'automation' : 'robotics');
  const mk2 = RESEARCH_IDS.some(id => {
    const { effect } = RESEARCH[id];
    return effect.kind === 'upgrade' && effect.machine === machine && researched(progress, research, id);
  });
  if (level === 2) return mk2;
  return mk2 && RESEARCH_IDS.some(id => RESEARCH[id].effect.kind === 'mk3' && researched(progress, research, id));
}

/** Storage capacity of a building, raised by research for the receiving dock. */
export function capacityOf(progress: Progress, research: ResearchState, type: MachineType): number {
  if (type !== 'receiving') return MACHINES[type].capacity;
  return RESEARCH_IDS.reduce((capacity, id) => {
    const { effect } = RESEARCH[id];
    return effect.kind === 'dock-capacity' && researched(progress, research, id) ? Math.max(capacity, effect.capacity) : capacity;
  }, MACHINES.receiving.capacity);
}

/** Rejection rhythm of a recipe once quality research is done. */
export function rejectionEvery(progress: Progress, research: ResearchState, recipe: Recipe): number | null {
  if (!recipe.rejection) return null;
  return RESEARCH_IDS.reduce((every, id) => {
    const { effect } = RESEARCH[id];
    return effect.kind === 'rejection' && researched(progress, research, id) ? Math.max(every, effect.every) : every;
  }, recipe.rejection.every);
}
