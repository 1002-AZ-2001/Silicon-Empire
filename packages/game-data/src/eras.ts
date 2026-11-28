import { TIME } from './construction';
import type { ItemType } from './items';
import type { StandardModel } from './production';

/**
 * Career timeline. A career starts in a chosen year; one month of the calendar lasts one staff pay
 * period (5 simulated minutes). Each era brings the PC parts of its time, with fictional brands
 * inspired by real hardware history (see docs/GAME_BALANCE.md for the sources):
 * - 1975: 8-bit microcomputers on an S-100 style bus, 8-inch floppy disks;
 * - 1983: 16-bit PCs with a 10 MB hard disk;
 * - 1986: 32-bit processors, 40 MB disks, tower cases;
 * - 1997: 233 MHz processors, AGP boards and the first 3D accelerators;
 * - 2005: 64-bit dual-core processors, PCI Express, 256 MB graphics cards;
 * - 2017: the modern catalogue.
 * Classic and sandbox workshops always use the modern era.
 */
export const ERA_IDS = ['8bit', '16bit', '32bit', '3d', '64bit', 'modern'] as const;
export type EraId = (typeof ERA_IDS)[number];

export const START_YEARS = [1975, 1985, 1995, 2005, 2017] as const;
export type StartYear = (typeof START_YEARS)[number];

/** Parts of an era's office PC. Gaming adds the graphics card. */
export interface EraParts {
  readonly cpu: ItemType;
  readonly ram: ItemType;
  readonly storage: ItemType;
  readonly board: ItemType;
  readonly psu: ItemType;
  readonly case: ItemType;
  /** Graphics card of the era, if 3D cards exist yet. */
  readonly gpu: ItemType | null;
}

export interface Era {
  /** First year the parts are on sale, from January. */
  readonly year: number;
  /** Retooling licence paid to move the assembly lines to this era. */
  readonly costCents: number;
  readonly parts: EraParts;
  /** PC models the era can assemble, in career. */
  readonly models: readonly StandardModel[];
}

export const ERAS: Readonly<Record<EraId, Era>> = {
  '8bit': {
    year: 1975, costCents: 0, models: ['office'],
    parts: { cpu: 'cpu-8bit', ram: 'ram-4k', storage: 'floppy-8in', board: 'board-s100', psu: 'psu-linear', case: 'case-desk', gpu: null },
  },
  '16bit': {
    year: 1983, costCents: 2_000_000, models: ['office'],
    parts: { cpu: 'cpu-16bit', ram: 'ram-640k', storage: 'hdd-10m', board: 'board-isa8', psu: 'psu-linear', case: 'case-desk', gpu: null },
  },
  '32bit': {
    year: 1986, costCents: 3_000_000, models: ['office'],
    parts: { cpu: 'cpu-32bit', ram: 'ram-1m', storage: 'hdd-40m', board: 'board-isa16', psu: 'psu-at', case: 'case-tower', gpu: null },
  },
  '3d': {
    year: 1997, costCents: 4_000_000, models: ['office', 'gaming'],
    parts: { cpu: 'cpu-233m', ram: 'ram-32m', storage: 'hdd-4g', board: 'board-agp', psu: 'psu-at', case: 'case-tower', gpu: 'gpu-3d' },
  },
  '64bit': {
    year: 2005, costCents: 5_000_000, models: ['office', 'gaming', 'professional'],
    parts: { cpu: 'cpu-64bit', ram: 'ram-1g', storage: 'hdd-250g', board: 'board-pcie', psu: 'psu-450', case: 'case-standard', gpu: 'gpu-256m' },
  },
  modern: {
    year: 2017, costCents: 6_000_000, models: ['office', 'gaming', 'professional'],
    parts: { cpu: 'cpu-8c', ram: 'ram-16g', storage: 'ssd-1t', board: 'motherboard-atx', psu: 'psu-650', case: 'case-standard', gpu: 'gpu-8g' },
  },
};

/** Parts sold only in the historical eras; never offered in classic or sandbox workshops. */
export const ERA_ITEMS = [
  'cpu-8bit', 'cpu-16bit', 'cpu-32bit', 'cpu-233m', 'cpu-64bit',
  'ram-4k', 'ram-640k', 'ram-1m', 'ram-32m', 'ram-1g',
  'floppy-8in', 'hdd-10m', 'hdd-40m', 'hdd-4g', 'hdd-250g',
  'board-s100', 'board-isa8', 'board-isa16', 'board-agp', 'board-pcie',
  'psu-linear', 'psu-at', 'case-desk', 'case-tower', 'gpu-3d', 'gpu-256m',
] as const;

export const CALENDAR = {
  /** One month lasts one staff pay period: 5 simulated minutes. */
  monthTicks: TIME.ticksPerSecond * 300,
  /** Contract price lost per era behind the latest one on sale, in percent. */
  obsolescencePercent: 15,
  /** Lowest contract price, in percent of the catalogue price. */
  minPricePercent: 40,
} as const;

export function eraIndex(era: EraId): number {
  return ERA_IDS.indexOf(era);
}

/** The latest era on sale in a year: the first one before 1975. */
export function eraOfYear(year: number): EraId {
  let found: EraId = ERA_IDS[0];
  for (const era of ERA_IDS) if (ERAS[era].year <= year) found = era;
  return found;
}

/** Calendar date at a tick of a career started on 1 January of `startYear`. Months run from 0 to 11. */
export function dateAt(startYear: number, tick: number): { year: number; month: number } {
  const months = Math.floor(tick / CALENDAR.monthTicks);
  return { year: startYear + Math.floor(months / 12), month: months % 12 };
}

/** Ticks until 1 January of `year`, from the career start. */
export function ticksUntilYear(startYear: number, year: number): number {
  return Math.max(0, year - startYear) * 12 * CALENDAR.monthTicks;
}

/** Contract price, in percent of the catalogue price, of a PC built `behind` eras after the latest one. */
export function obsolescence(behind: number): number {
  return Math.max(CALENDAR.minPricePercent, 100 - Math.max(0, behind) * CALENDAR.obsolescencePercent);
}

/** Assembly inputs of a historical era, or undefined if the era cannot build the model. */
export function eraAssembly(era: EraId, model: StandardModel): Readonly<Partial<Record<ItemType, number>>> | undefined {
  const { parts, models } = ERAS[era];
  if (!models.includes(model)) return undefined;
  const office = { [parts.cpu]: 1, [parts.ram]: 1, [parts.storage]: 1, [parts.board]: 1, [parts.psu]: 1, [parts.case]: 1 };
  if (model === 'office' || !parts.gpu) return office;
  if (model === 'gaming') return { ...office, [parts.gpu]: 1 };
  // Workstations of 2005: two memory modules and two mirrored disks, on the larger power supply.
  return {
    [parts.cpu]: 1, [parts.gpu]: 1, [parts.ram]: 2, [parts.storage]: 2, [parts.board]: 1, 'psu-650': 1, [parts.case]: 1,
  };
}
