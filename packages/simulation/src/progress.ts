import {
  CAREER_START_MACHINES, ERAS, ERA_IDS, ERA_ITEMS, ITEMS, ITEM_TYPES, MACHINE_TYPES, MILESTONES, MILESTONE_IDS, STANDARD_MODELS, STARTING_ITEMS,
  STARTING_MACHINES, TECHNOLOGIES, TIERS, eraIndex, eraOfYear, recipeOf,
} from '@silicon-empire/game-data';
import type { EraId, HouseChip, ItemCategory, ItemType, MachineType, MilestoneId, ProductModel, StartYear } from '@silicon-empire/game-data';
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

export function createCareerProgress(tick = 0, startYear?: StartYear): Progress {
  return { sandbox: false, completed: [], active: null, delivered: {}, career: createCareer(tick, startYear) };
}

/** The company's own chips in its PCs; none outside careers. */
export function chipsOf(progress: Progress): readonly HouseChip[] {
  return progress.career?.houseChips ?? [];
}

/** Era of the parts the assembly lines take: the modern one outside careers. */
export function eraOf(progress: Progress): EraId {
  return progress.career?.era ?? 'modern';
}

const PC_PART_CATEGORIES: readonly ItemCategory[] = ['cpu', 'gpu', 'ram', 'storage', 'motherboard', 'power-supply', 'case'];

export function isPcPart(item: ItemType): boolean {
  return PC_PART_CATEGORIES.includes(ITEMS[item].category);
}

/** PC parts an era's assembly lines take, whatever the model. */
export function eraPartsOf(era: EraId): readonly ItemType[] {
  return ITEM_TYPES.filter(item => STANDARD_MODELS.some(model => (recipeOf('assembler', model, null, era)?.inputs[item] ?? 0) > 0));
}

const partsCache = new Map<string, readonly ItemType[]>();

/**
 * PC parts of the eras from `first` to `last`. A career sells the parts of every era from its start to
 * the latest one on sale: older parts stay available, those of eras before the start never appear.
 */
export function partsBetween(first: EraId, last: EraId): readonly ItemType[] {
  const key = `${first}:${last}`;
  let parts = partsCache.get(key);
  if (!parts) {
    const eras = ERA_IDS.slice(eraIndex(first), eraIndex(last) + 1);
    parts = ITEM_TYPES.filter(item => eras.some(era => eraPartsOf(era).includes(item)));
    partsCache.set(key, parts);
  }
  return parts;
}

/** First era whose assembly lines take a part, if any. */
export function eraOfPart(item: ItemType): EraId | undefined {
  return ERA_IDS.find(era => eraPartsOf(era).includes(item));
}

export function partYear(item: ItemType): number | undefined {
  const era = eraOfPart(item);
  return era && ERAS[era].year;
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
  if (progress.career) {
    return model !== 'custom' && progress.career.technologies.includes('computers') && ERAS[progress.career.era].models.includes(model);
  }
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

/**
 * Items the receiving dock can order: bought from suppliers and unlocked. In a career, the computers
 * licence opens the PC parts of every era on sale; historical parts are never sold elsewhere.
 */
export function orderableItems(progress: Progress): ReadonlySet<ItemType> {
  const { career } = progress;
  const unlocked = progress.sandbox
    ? ITEM_TYPES.filter(item => !(ERA_ITEMS as readonly ItemType[]).includes(item))
    : career
      ? [
        ...career.technologies.flatMap(tech => TECHNOLOGIES[tech].unlocks.items).filter(item => !isPcPart(item)),
        ...career.technologies.includes('computers') ? partsBetween(eraOfYear(career.startYear), career.released) : [],
      ]
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
