import { REGIONS, TRANSFER, TRANSPORT_MODES, weightOf } from '@silicon-empire/game-data';
import type { ItemType, RegionId, TransportMode } from '@silicon-empire/game-data';
import { ABROAD } from '@silicon-empire/game-data';
import type { Inventory } from './inventory';

/** A layout of the company: the home workshop or a site abroad. */
export type Place = RegionId | 'home';

/** Where a routed shipping dock sends what it gathers: a receiving dock of another site. */
export interface Route {
  readonly to: Place;
  readonly dockId: number;
  readonly mode: TransportMode;
}

/** Units on their way between two sites. */
export interface Transfer {
  readonly id: number;
  readonly item: ItemType;
  readonly units: number;
  readonly from: Place;
  readonly to: Place;
  readonly dockId: number;
  readonly dueTick: number;
}

export interface TransferState {
  /** In dispatch order. */
  readonly list: readonly Transfer[];
  readonly nextId: number;
  /** Freight paid. */
  readonly spentCents: number;
}

export const NO_TRANSFERS: TransferState = { list: [], nextId: 1, spentCents: 0 };

export function placeOf(region: RegionId | undefined): Place {
  return region ?? 'home';
}

/** Days between two sites: the longer of the two legs to the home workshop. */
export function transferDays(from: Place, to: Place, mode: TransportMode): number {
  const leg = (place: Place) => place === 'home' ? 0 : REGIONS[place].days[mode];
  return Math.max(leg(from), leg(to), 1);
}

export function transferTicks(from: Place, to: Place, mode: TransportMode): number {
  return transferDays(from, to, mode) * ABROAD.dayTicks;
}

/** Freight of a shipment: its weight at the dearer of the two regions' rates, at least the home rate of one cent per kilogram. */
export function transferCost(from: Place, to: Place, mode: TransportMode, stock: Inventory): number {
  const rate = (place: Place) => place === 'home' ? 0 : REGIONS[place].freightCentsPerKg[mode];
  const perKg = Math.max(rate(from), rate(to), 1);
  return (Object.entries(stock) as [ItemType, number][]).reduce((total, [item, units]) => total + Math.ceil(weightOf(item) * units * perKg), 0);
}

/** Longest transfer between any two sites, for checks. */
export const MAX_TRANSFER_TICKS = Math.max(
  ...TRANSPORT_MODES.flatMap(mode => Object.keys(REGIONS).map(region => transferTicks(region as RegionId, 'home', mode))),
  TRANSFER.retryTicks,
);

export function validRoute(route: Route): boolean {
  return TRANSPORT_MODES.includes(route.mode) && Number.isSafeInteger(route.dockId) && route.dockId > 0 &&
    (route.to === 'home' || route.to in REGIONS);
}
