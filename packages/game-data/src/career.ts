import type { MachineType } from './construction';
import type { ItemType } from './items';

/**
 * Career mode: the company starts with no money and one specialty, borrows from the bank and buys
 * licences to open the other branches, board assembly, then computer assembly.
 */
export const SPECIALTIES = ['passives', 'pcb', 'power'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export const TECH_IDS = [...SPECIALTIES, 'smt', 'computers', 'automation', 'robotics'] as const;
export type TechId = (typeof TECH_IDS)[number];

export interface Technology {
  /** Licence price. The chosen specialty is free. */
  readonly costCents: number;
  /** Technologies required first. */
  readonly requires: readonly TechId[];
  /** Number of branch licences (specialties) required first. */
  readonly branches: number;
  readonly unlocks: { readonly machines: readonly MachineType[]; readonly items: readonly ItemType[] };
}

export const TECHNOLOGIES: Readonly<Record<TechId, Technology>> = {
  passives: { costCents: 2_000_000, requires: [], branches: 0, unlocks: { machines: ['capacitor-press'], items: ['ceramic-powder', 'copper-foil'] } },
  pcb: { costCents: 2_000_000, requires: [], branches: 0, unlocks: { machines: ['pcb-etcher'], items: ['fiberglass-sheet', 'copper-foil'] } },
  power: { costCents: 2_000_000, requires: [], branches: 0, unlocks: { machines: ['coil-winder'], items: ['ferrite-core', 'copper-foil'] } },
  smt: {
    costCents: 4_000_000, requires: [], branches: 2,
    unlocks: { machines: ['smt-line'], items: ['capacitor-reel', 'bare-pcb', 'transformer'] },
  },
  computers: {
    costCents: 8_000_000, requires: ['smt'], branches: 0,
    unlocks: {
      machines: ['assembler', 'tester', 'packager', 'warehouse', 'conveyor-fast', 'lab'],
      items: ['cpu-8c', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard', 'carton'],
    },
  },
  /** Mk2 upgrades for every production machine. */
  automation: { costCents: 3_000_000, requires: [], branches: 1, unlocks: { machines: [], items: [] } },
  /** Mk3 upgrades. */
  robotics: { costCents: 6_000_000, requires: ['automation', 'smt'], branches: 0, unlocks: { machines: [], items: [] } },
};

/** Buildings open from the first day of a career. */
export const CAREER_START_MACHINES: readonly MachineType[] = [
  'receiving', 'storage', 'conveyor', 'splitter', 'merger', 'shipping', 'wall', 'door', 'sofa', 'coffee', 'desk',
  'grid-connection', 'generator',
];

/** Price the wholesaler pays at the shipping dock, per unit. */
export const MARKET_PRICES: Readonly<Partial<Record<ItemType, number>>> = {
  'capacitor-reel': 14_000,
  'bare-pcb': 18_000,
  transformer: 24_000,
  'circuit-board': 90_000,
};

export const LOAN_IDS = ['starter', 'growth', 'expansion'] as const;
export type LoanId = (typeof LOAN_IDS)[number];

export interface LoanOffer {
  readonly principalCents: number;
  /** Total interest over the loan, in percent of the principal. */
  readonly interestPercent: number;
  /** Monthly instalments; a month is one staff pay period. */
  readonly months: number;
}

export const LOANS: Readonly<Record<LoanId, LoanOffer>> = {
  starter: { principalCents: 2_000_000, interestPercent: 4, months: 24 },
  growth: { principalCents: 5_000_000, interestPercent: 6, months: 24 },
  expansion: { principalCents: 10_000_000, interestPercent: 9, months: 36 },
};

export function instalment(offer: LoanOffer): number {
  return Math.ceil(offer.principalCents * (100 + offer.interestPercent) / 100 / offer.months);
}

export const CAREER = {
  initialCapitalCents: 0,
  /** Consecutive unpaid instalments before bankruptcy. */
  maxMissed: 3,
} as const;
