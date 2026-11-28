import type { ItemType } from './items';
import type { StandardModel } from './production';

/**
 * Career competition. Each market has a monthly demand; fictional rivals supply part of it and the
 * company adds what it sells. Every month the price index of a market moves towards the level the
 * total supply allows, and rivals grow where prices are high and shrink where they are low.
 */
export const MARKET_IDS = [
  'capacitor-reel', 'bare-pcb', 'transformer', 'circuit-board', 'office', 'gaming', 'professional', 'chip-ram', 'chip-cpu', 'chip-gpu',
] as const;
export type MarketId = (typeof MARKET_IDS)[number];

/** Units the market buys per month at the reference price. */
export const MARKET_DEMAND: Readonly<Record<MarketId, number>> = {
  'capacitor-reel': 300, 'bare-pcb': 300, transformer: 240, 'circuit-board': 120, office: 60, gaming: 30, professional: 20,
  'chip-ram': 200, 'chip-cpu': 100, 'chip-gpu': 60,
};

/** Market of an item sold to the wholesaler, if any. */
export function marketOfItem(item: ItemType): MarketId | undefined {
  return (MARKET_IDS as readonly string[]).includes(item) ? item as MarketId : undefined;
}

export function marketOfModel(model: StandardModel): MarketId {
  return model;
}

export const RIVAL_IDS = ['helion', 'vortek', 'norrland', 'kaori', 'xinhe'] as const;
export type RivalId = (typeof RIVAL_IDS)[number];

export interface Rival {
  /** Fictional company. */
  readonly name: string;
  /** Year the rival enters the markets. */
  readonly entryYear: number;
  /** Share of the demand it supplies on entry, per market, in percent. */
  readonly markets: Readonly<Partial<Record<MarketId, number>>>;
  /** Chance per month, in percent, of a price war: a burst of supply on one of its markets. */
  readonly aggressiveness: number;
}

export const RIVALS: Readonly<Record<RivalId, Rival>> = {
  helion: { name: 'Helion Microdevices', entryYear: 1975, markets: { 'capacitor-reel': 30, 'bare-pcb': 25, transformer: 20, 'chip-ram': 30 }, aggressiveness: 5 },
  vortek: { name: 'Vortek Systems', entryYear: 1975, markets: { office: 35, gaming: 25 }, aggressiveness: 8 },
  norrland: { name: 'Norrland Data', entryYear: 1983, markets: { office: 20, professional: 40, 'circuit-board': 20, 'chip-cpu': 30 }, aggressiveness: 4 },
  kaori: { name: 'Kaori Denki', entryYear: 1986, markets: { 'circuit-board': 30, transformer: 25, gaming: 25, 'chip-gpu': 35 }, aggressiveness: 6 },
  xinhe: { name: 'Xinhe Electronics', entryYear: 1990, markets: { 'capacitor-reel': 30, 'bare-pcb': 35, transformer: 20, office: 15, 'chip-ram': 25 }, aggressiveness: 10 },
};

export const COMPETITION = {
  /** Price index bounds, in percent of the reference price. */
  minPercent: 60,
  maxPercent: 130,
  /** Index change for a supply gap of the whole demand: 40 points. */
  elasticity: 40,
  /** Rivals grow by this share of their supply when the index is at least `growFrom`, and shrink below `shrinkFrom`. */
  stepPercent: 10,
  growFrom: 105,
  shrinkFrom: 90,
  /** A price war adds this share of the demand to the rival's supply for one month. */
  priceWarPercent: 30,
  /** Supply of a rival on a market stays within these shares of the demand. */
  minSupplyPercent: 5,
  maxSupplyPercent: 80,
  /** News kept for the competition panel. */
  maxNews: 8,
} as const;
