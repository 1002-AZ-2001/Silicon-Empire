import type { MachineType } from './construction';
import type { ItemType } from './items';
import type { MilestoneId } from './progression';

/**
 * Research projects, run at the laboratory. Parts are delivered by conveyor like milestones;
 * once all have arrived, the analysis runs for `ticks` while at least one laboratory exists.
 * Only one project is analysed at a time. Effects are permanent.
 */
export const RESEARCH_IDS = [
  'assembly-mk2', 'testing-mk2', 'packaging-mk2', 'dock-expansion', 'express-belts', 'yield-control', 'advanced-automation',
] as const;
export type ResearchId = (typeof RESEARCH_IDS)[number];

/** Production machines that can be upgraded in place to Mk2. */
export const UPGRADABLE_MACHINES = ['assembler', 'tester', 'packager'] as const;
export type UpgradableMachine = (typeof UPGRADABLE_MACHINES)[number];

export type ResearchEffect =
  | { readonly kind: 'upgrade'; readonly machine: UpgradableMachine }
  | { readonly kind: 'machine'; readonly machine: MachineType }
  | { readonly kind: 'dock-capacity'; readonly capacity: number }
  | { readonly kind: 'rejection'; readonly every: number }
  /** Mk3 upgrades for every machine that has Mk2. */
  | { readonly kind: 'mk3' };

export interface Research {
  readonly cost: Readonly<Partial<Record<ItemType, number>>>;
  /** Analysis duration once every part has arrived, at 20 ticks per second. */
  readonly ticks: number;
  readonly requires: { readonly milestones?: readonly MilestoneId[]; readonly research?: readonly ResearchId[] };
  readonly effect: ResearchEffect;
}

export const RESEARCH: Readonly<Record<ResearchId, Research>> = {
  'assembly-mk2': {
    cost: { 'pc-office-tested': 20 },
    ticks: 1_200,
    requires: { milestones: ['flow-control'] },
    effect: { kind: 'upgrade', machine: 'assembler' },
  },
  'testing-mk2': {
    cost: { 'pc-office-packaged': 15 },
    ticks: 1_200,
    requires: { milestones: ['packaging'], research: ['assembly-mk2'] },
    effect: { kind: 'upgrade', machine: 'tester' },
  },
  'packaging-mk2': {
    cost: { 'pc-office-packaged': 25 },
    ticks: 1_200,
    requires: { research: ['testing-mk2'] },
    effect: { kind: 'upgrade', machine: 'packager' },
  },
  'dock-expansion': {
    cost: { 'pc-office-tested': 30 },
    ticks: 1_800,
    requires: { milestones: ['warehouse'] },
    effect: { kind: 'dock-capacity', capacity: 200 },
  },
  'express-belts': {
    cost: { 'pc-gaming-packaged': 15 },
    ticks: 2_400,
    requires: { milestones: ['campus-contract'] },
    effect: { kind: 'machine', machine: 'conveyor-express' },
  },
  'yield-control': {
    cost: { 'pc-professional-packaged': 8 },
    ticks: 2_400,
    requires: { milestones: ['professional-rollout'] },
    effect: { kind: 'rejection', every: 16 },
  },
  'advanced-automation': {
    cost: { 'pc-gaming-packaged': 20 },
    ticks: 3_000,
    requires: { research: ['packaging-mk2'] },
    effect: { kind: 'mk3' },
  },
};

/** Mk2 runs batches this many times faster. Upgrading is paid once per machine. */
export const MK2 = {
  speed: 2,
  costCents: { assembler: 300_000, tester: 350_000, packager: 400_000 },
} as const satisfies { speed: number; costCents: Record<UpgradableMachine, number> };
