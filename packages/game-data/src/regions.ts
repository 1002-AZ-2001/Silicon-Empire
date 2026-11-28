import { CALENDAR } from './eras';
import type { ItemType } from './items';

/**
 * Career world map: the company's workshop stands in Western Europe; the licence « Expansion
 * internationale » lets it buy one factory in each other region. A factory makes one product every
 * month at the region's costs, then sells it on the local market or ships it home by sea (by road
 * in Europe) or by air. Figures are orders of magnitude from public data (see docs/GAME_BALANCE.md).
 */
export const REGION_IDS = [
  'western-europe', 'eastern-europe', 'north-america', 'mexico', 'brazil', 'india', 'china', 'east-asia',
] as const;
export type RegionId = (typeof REGION_IDS)[number];
export const HOME_REGION: RegionId = 'western-europe';

export const TRANSPORT_MODES = ['surface', 'air'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export interface Region {
  /** First year a factory can be bought there. */
  readonly openYear: number;
  readonly factoryCostCents: number;
  /** Labour cost, in percent of Western Europe. */
  readonly wagePercent: number;
  /** Price of materials and parts bought locally, in percent. */
  readonly materialPercent: number;
  /** Local selling price, in percent of the home price. */
  readonly marketPercent: number;
  /** Days to the home dock: by sea (by road from Eastern Europe), then by air. */
  readonly days: Readonly<Record<TransportMode, number>>;
  /** Freight price per kilogram. */
  readonly freightCentsPerKg: Readonly<Record<TransportMode, number>>;
  /** Marker on the map, in percent of its width and height. */
  readonly map: { readonly x: number; readonly y: number };
}

export const REGIONS: Readonly<Record<RegionId, Region>> = {
  'western-europe': {
    openYear: 0, factoryCostCents: 0, wagePercent: 100, materialPercent: 100, marketPercent: 100,
    days: { surface: 0, air: 0 }, freightCentsPerKg: { surface: 0, air: 0 }, map: { x: 48, y: 30 },
  },
  'eastern-europe': {
    openYear: 1990, factoryCostCents: 12_000_000, wagePercent: 30, materialPercent: 100, marketPercent: 75,
    days: { surface: 3, air: 1 }, freightCentsPerKg: { surface: 15, air: 150 }, map: { x: 56, y: 28 },
  },
  'north-america': {
    openYear: 1975, factoryCostCents: 20_000_000, wagePercent: 85, materialPercent: 100, marketPercent: 105,
    days: { surface: 12, air: 2 }, freightCentsPerKg: { surface: 20, air: 300 }, map: { x: 22, y: 32 },
  },
  mexico: {
    openYear: 1975, factoryCostCents: 10_000_000, wagePercent: 15, materialPercent: 95, marketPercent: 70,
    days: { surface: 18, air: 2 }, freightCentsPerKg: { surface: 25, air: 350 }, map: { x: 18, y: 46 },
  },
  brazil: {
    openYear: 1975, factoryCostCents: 10_000_000, wagePercent: 20, materialPercent: 105, marketPercent: 70,
    days: { surface: 20, air: 2 }, freightCentsPerKg: { surface: 25, air: 350 }, map: { x: 32, y: 68 },
  },
  india: {
    openYear: 1991, factoryCostCents: 10_000_000, wagePercent: 8, materialPercent: 95, marketPercent: 55,
    days: { surface: 25, air: 2 }, freightCentsPerKg: { surface: 25, air: 300 }, map: { x: 68, y: 46 },
  },
  china: {
    openYear: 1980, factoryCostCents: 15_000_000, wagePercent: 20, materialPercent: 85, marketPercent: 65,
    days: { surface: 34, air: 3 }, freightCentsPerKg: { surface: 30, air: 350 }, map: { x: 77, y: 38 },
  },
  'east-asia': {
    openYear: 1975, factoryCostCents: 25_000_000, wagePercent: 55, materialPercent: 90, marketPercent: 100,
    days: { surface: 36, air: 3 }, freightCentsPerKg: { surface: 30, air: 400 }, map: { x: 86, y: 34 },
  },
};

/** Products a factory abroad can make, with its monthly output, labour at home wages and weight. */
export const SUBSIDIARY_PRODUCTS = ['capacitor-reel', 'bare-pcb', 'transformer', 'circuit-board', 'pc-office-packaged'] as const;
export type SubsidiaryProduct = (typeof SUBSIDIARY_PRODUCTS)[number];

export interface ProductLine {
  readonly unitsPerMonth: number;
  readonly laborCents: number;
  readonly weightKg: number;
}

export const PRODUCT_LINES: Readonly<Record<SubsidiaryProduct, ProductLine>> = {
  'capacitor-reel': { unitsPerMonth: 100, laborCents: 3_000, weightKg: 2 },
  'bare-pcb': { unitsPerMonth: 100, laborCents: 3_500, weightKg: 1 },
  transformer: { unitsPerMonth: 80, laborCents: 4_000, weightKg: 3 },
  'circuit-board': { unitsPerMonth: 40, laborCents: 8_000, weightKg: 1 },
  'pc-office-packaged': { unitsPerMonth: 30, laborCents: 6_000, weightKg: 12 },
};

export const SUBSIDIARY_DESTINATIONS = ['local', 'export', 'dock'] as const;
/** Where the output goes: the local market, the home wholesaler on arrival, or a receiving dock of the workshop. */
export type SubsidiaryDestination = (typeof SUBSIDIARY_DESTINATIONS)[number];

export const ABROAD = {
  /** One day of the calendar: a month lasts 30 days. */
  dayTicks: CALENDAR.monthTicks / 30,
  /** Monthly cost of running a factory, at home wages: management, upkeep, security. */
  overheadCents: 300_000,
  /** Shipments waiting for room at a dock try again every this many ticks. */
  retryTicks: 20,
} as const;

/** Items that need materials of the career chain, at the price the factory pays for them locally. */
export const PRODUCT_INPUTS: Readonly<Record<Exclude<SubsidiaryProduct, 'pc-office-packaged'>, Readonly<Partial<Record<ItemType, number>>>>> = {
  'capacitor-reel': { 'ceramic-powder': 2, 'copper-foil': 1 },
  'bare-pcb': { 'fiberglass-sheet': 1, 'copper-foil': 2 },
  transformer: { 'copper-foil': 2, 'ferrite-core': 2 },
  'circuit-board': { 'bare-pcb': 1, 'capacitor-reel': 2, transformer: 1 },
};
