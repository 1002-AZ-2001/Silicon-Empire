import { TIME } from './construction';
import type { MachineType } from './construction';

/**
 * Electricity and wear, for workshops created from v0.11.0 on. Machines draw power from the network
 * of cables they touch; sources feed that network. Production machines wear out with each batch.
 */
export const POWER_USE_KW: Readonly<Partial<Record<MachineType, number>>> = {
  assembler: 10, tester: 8, packager: 6, lab: 20,
  'capacitor-press': 12, 'pcb-etcher': 15, 'coil-winder': 15, 'smt-line': 30,
};

export interface PowerSource {
  readonly supplyKw: number;
  /** Monthly cost per kW drawn by the machines of its network (grid), or flat (fuel). */
  readonly billPerKwCents: number;
  readonly monthlyCents: number;
}

export const POWER_SOURCES: Readonly<Partial<Record<MachineType, PowerSource>>> = {
  'grid-connection': { supplyKw: 150, billPerKwCents: 1_200, monthlyCents: 0 },
  generator: { supplyKw: 60, billPerKwCents: 0, monthlyCents: 40_000 },
};

export const POWER = {
  /** Price of one tile of cable. Cables lie under buildings and conveyors. */
  cableCostCents: 500,
  /** Bills are paid once a month, like salaries. */
  billPeriodTicks: TIME.ticksPerSecond * 300,
} as const;

export const UPGRADE_LEVELS = [2, 3] as const;
export type UpgradeLevel = (typeof UPGRADE_LEVELS)[number];
export type MachineLevel = 1 | UpgradeLevel;

/** Speed, power draw and wear by machine level. */
export const LEVELS: Readonly<Record<MachineLevel, { readonly speed: number; readonly powerPercent: number; readonly wearPerBatch: number }>> = {
  1: { speed: 1, powerPercent: 100, wearPerBatch: 2 },
  2: { speed: 2, powerPercent: 150, wearPerBatch: 2 },
  3: { speed: 3, powerPercent: 200, wearPerBatch: 1 },
};

/** Upgrade price to Mk2 and to Mk3 for each production machine. */
export const UPGRADE_COSTS: Readonly<Partial<Record<MachineType, Readonly<Record<UpgradeLevel, number>>>>> = {
  assembler: { 2: 300_000, 3: 600_000 },
  tester: { 2: 350_000, 3: 700_000 },
  packager: { 2: 400_000, 3: 800_000 },
  'capacitor-press': { 2: 400_000, 3: 800_000 },
  'pcb-etcher': { 2: 500_000, 3: 1_000_000 },
  'coil-winder': { 2: 550_000, 3: 1_100_000 },
  'smt-line': { 2: 1_200_000, 3: 2_400_000 },
};

export const WEAR = {
  /** A machine stops at this wear until it is repaired. */
  breakdown: 200,
  /** From this wear on, batches take `slowPercent` of their time. */
  slowFrom: 140,
  slowPercent: 125,
  /** Repair price in percent of what the machine cost, upgrades included. */
  repairPercent: 10,
} as const;
