import type { MachineType } from './construction';
import type { ItemType } from './items';

/**
 * Progression by tiers and milestones. A milestone is completed by delivering parts to the headquarters.
 * Tier 0 milestones follow a fixed order; completing tier 0 opens tiers 1 and 2, whose milestones can be
 * done in any order. Later tiers will be opened by flagship contracts.
 */
export const MILESTONE_IDS = [
  'assembly-bench', 'quality-control', 'flow-control',
  'packaging', 'warehouse',
  'fast-belts', 'regional-grant',
] as const;
export type MilestoneId = (typeof MILESTONE_IDS)[number];

export interface Milestone {
  readonly tier: number;
  readonly cost: Readonly<Partial<Record<ItemType, number>>>;
  readonly unlocks: { readonly machines: readonly MachineType[]; readonly items: readonly ItemType[] };
  /** Capital granted on completion. Always higher than the supplier price of the parts it asks for. */
  readonly rewardCents: number;
}

export const MILESTONES: Readonly<Record<MilestoneId, Milestone>> = {
  'assembly-bench': {
    tier: 0,
    cost: { 'case-standard': 10, 'psu-650': 10 },
    unlocks: { machines: ['assembler'], items: [] },
    rewardCents: 150_000,
  },
  'quality-control': {
    tier: 0,
    cost: { 'pc-office': 5 },
    unlocks: { machines: ['tester'], items: [] },
    rewardCents: 500_000,
  },
  'flow-control': {
    tier: 0,
    cost: { 'pc-office-tested': 10 },
    unlocks: { machines: ['splitter', 'merger'], items: [] },
    rewardCents: 750_000,
  },
  packaging: {
    tier: 1,
    cost: { 'pc-office-tested': 20 },
    unlocks: { machines: ['packager'], items: ['carton'] },
    rewardCents: 1_200_000,
  },
  warehouse: {
    tier: 1,
    cost: { 'pc-office-tested': 15, 'ram-16g': 30 },
    unlocks: { machines: ['warehouse'], items: [] },
    rewardCents: 1_000_000,
  },
  'fast-belts': {
    tier: 2,
    cost: { 'pc-office-packaged': 20 },
    unlocks: { machines: ['conveyor-fast'], items: [] },
    rewardCents: 1_200_000,
  },
  'regional-grant': {
    tier: 2,
    cost: { 'pc-office-packaged': 30 },
    unlocks: { machines: [], items: [] },
    rewardCents: 2_500_000,
  },
};

export const TIERS = [
  { tier: 0, sequential: true, openedBy: null },
  { tier: 1, sequential: false, openedBy: 0 },
  { tier: 2, sequential: false, openedBy: 0 },
] as const satisfies readonly { tier: number; sequential: boolean; openedBy: number | null }[];

/** Available in a new progression game before any milestone. */
export const STARTING_MACHINES: readonly MachineType[] = ['storage', 'receiving', 'conveyor', 'headquarters'];
export const STARTING_ITEMS: readonly ItemType[] = [
  'cpu-8c', 'gpu-8g', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard',
];
