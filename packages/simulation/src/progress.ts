import {
  CAREER_START_MACHINES, ITEMS, MACHINE_TYPES, MILESTONES, MILESTONE_IDS, STARTING_ITEMS, STARTING_MACHINES, TECHNOLOGIES, TIERS,
} from '@silicon-empire/game-data';
import type { ItemType, MachineType, MilestoneId, ProductModel } from '@silicon-empire/game-data';
import { createCareer } from './career';
import type { CareerState } from './career';
import type { Inventory } from './inventory';

/** Progression state. In sandbox mode everything is unlocked and milestones are not used. */
export interface Progress {
  readonly sandbox: boolean;
  /** Completed milestones in completion order. */
  readonly completed: readonly MilestoneId[];
  /** Milestone that receives deliveries at the headquarters. */
  readonly active: MilestoneId | null;
  /** Parts already delivered to each unfinished milestone. Kept when the active milestone changes. */
  readonly delivered: Readonly<Partial<Record<MilestoneId, Inventory>>>;
  /** Career workshops: specialty, licences, loans and wholesale sales. Milestones are not used. */
  readonly career?: CareerState;
}

export function createProgress(sandbox: boolean): Progress {
  return { sandbox, completed: [], active: null, delivered: {} };
}

export function createCareerProgress(tick = 0): Progress {
  return { sandbox: false, completed: [], active: null, delivered: {}, career: createCareer(tick) };
}

function milestonesOf(tier: number): MilestoneId[] {
  return MILESTONE_IDS.filter(id => MILESTONES[id].tier === tier);
}

export function tierCompleted(progress: Progress, tier: number): boolean {
  return milestonesOf(tier).every(id => progress.completed.includes(id));
}

/** Tier 0 is open from the start; the others open when the tier named by `openedBy` is completed. */
export function tierOpen(progress: Progress, tier: number): boolean {
  const definition = TIERS.find(candidate => candidate.tier === tier);
  if (!definition) return false;
  return definition.openedBy === null || tierCompleted(progress, definition.openedBy);
}

/** A milestone can be chosen when its tier is open and, in a sequential tier, the previous ones are done. */
export function milestoneAvailable(progress: Progress, id: MilestoneId): boolean {
  if (progress.sandbox || progress.career || progress.completed.includes(id)) return false;
  const { tier, requires } = MILESTONES[id];
  if (!tierOpen(progress, tier)) return false;
  if (requires?.some(requirement => !progress.completed.includes(requirement))) return false;
  const definition = TIERS.find(candidate => candidate.tier === tier);
  if (!definition?.sequential) return true;
  const ordered = milestonesOf(tier);
  return ordered.slice(0, ordered.indexOf(id)).every(previous => progress.completed.includes(previous));
}

export function modelUnlocked(progress: Progress, model: ProductModel): boolean {
  if (progress.career) return model === 'office' && progress.career.technologies.includes('computers');
  return model === 'office' || progress.sandbox ||
    progress.completed.some(id => MILESTONES[id].unlocks.models?.includes(model));
}

export function unlockedMachines(progress: Progress): ReadonlySet<MachineType> {
  if (progress.sandbox) return new Set(MACHINE_TYPES);
  if (progress.career) {
    return new Set([...CAREER_START_MACHINES, ...progress.career.technologies.flatMap(tech => TECHNOLOGIES[tech].unlocks.machines)]);
  }
  return new Set([...STARTING_MACHINES, ...progress.completed.flatMap(id => MILESTONES[id].unlocks.machines)]);
}

/** Items the receiving dock can order: bought from suppliers and unlocked. */
export function orderableItems(progress: Progress): ReadonlySet<ItemType> {
  const unlocked = progress.sandbox
    ? Object.keys(ITEMS) as ItemType[]
    : progress.career
      ? progress.career.technologies.flatMap(tech => TECHNOLOGIES[tech].unlocks.items)
      : [...STARTING_ITEMS, ...progress.completed.flatMap(id => MILESTONES[id].unlocks.items)];
  return new Set(unlocked.filter(item => ITEMS[item].unitCostCents !== null));
}

/** Units of `item` the active milestone still needs. */
export function stillNeeded(progress: Progress, item: ItemType): number {
  if (!progress.active) return 0;
  const required = MILESTONES[progress.active].cost[item] ?? 0;
  return Math.max(0, required - (progress.delivered[progress.active]?.[item] ?? 0));
}

export function milestoneDone(progress: Progress, id: MilestoneId): boolean {
  const delivered = progress.delivered[id] ?? {};
  return Object.entries(MILESTONES[id].cost).every(([item, count]) => (delivered[item as ItemType] ?? 0) >= (count ?? 0));
}

/** Capital granted by the milestones completed so far. */
export function rewardsEarned(progress: Progress): number {
  return progress.completed.reduce((total, id) => total + MILESTONES[id].rewardCents, 0);
}
