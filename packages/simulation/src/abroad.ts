import {
  ABROAD, ITEMS, MARKET_PRICES, PRODUCT_INPUTS, PRODUCT_LINES, REGIONS, REGION_IDS, SUBSIDIARY_DESTINATIONS, SUBSIDIARY_PRODUCTS,
  TRANSPORT_MODES, dateAt, obsolescence, saleOffer,
} from '@silicon-empire/game-data';
import type {
  ItemType, MarketId, RegionId, SubsidiaryDestination, SubsidiaryProduct, TransportMode,
} from '@silicon-empire/game-data';
import { addItems } from './inventory';
import type { Inventory } from './inventory';

/** A factory abroad. Its month starts on the day it was bought. */
export interface Subsidiary {
  readonly region: RegionId;
  readonly product: SubsidiaryProduct | null;
  readonly destination: SubsidiaryDestination;
  readonly mode: TransportMode;
  /** Receiving dock for the `dock` destination. */
  readonly dockId: number | null;
  readonly nextRun: number;
  /** The last month could not be paid: nothing was made. */
  readonly idle: boolean;
}

/** Goods on their way home. */
export interface Shipment {
  readonly id: number;
  readonly region: RegionId;
  readonly item: SubsidiaryProduct;
  readonly units: number;
  readonly destination: Exclude<SubsidiaryDestination, 'local'>;
  readonly dockId: number | null;
  readonly dueTick: number;
}

export interface AbroadState {
  /** In purchase order, one per region at most. */
  readonly subsidiaries: readonly Subsidiary[];
  /** In dispatch order. */
  readonly shipments: readonly Shipment[];
  readonly nextShipmentId: number;
  /** Factories, monthly costs and freight paid. */
  readonly spentCents: number;
  /** Local sales and goods sold to the home wholesaler on arrival. */
  readonly revenueCents: number;
  /** Units delivered to the workshop's docks. */
  readonly imported: Inventory;
}

export const NO_ABROAD: AbroadState = { subsidiaries: [], shipments: [], nextShipmentId: 1, spentCents: 0, revenueCents: 0, imported: {} };

/** Price of a material at the factory: raw materials from suppliers, career components at their wholesale price. */
function materialPrice(item: ItemType): number {
  return MARKET_PRICES[item] ?? ITEMS[item].unitCostCents ?? 0;
}

/** Era of the company's PC parts, for factories that assemble PCs. */
export interface AbroadContext {
  readonly era: Parameters<typeof saleOffer>[2];
  /** Eras behind the latest one, for the price of PCs. */
  readonly behind: number;
  /** Price indexes of the home markets; absent means the reference prices. */
  readonly prices?: Readonly<Record<MarketId, number>>;
}

/** Home market of a product made abroad. */
export function marketOfProduct(product: SubsidiaryProduct): MarketId {
  return product === 'pc-office-packaged' ? 'office' : product;
}

/** Cost of one unit made in a region: local materials and local labour. */
export function unitCost(region: RegionId, product: SubsidiaryProduct, context: AbroadContext): number {
  const { materialPercent, wagePercent } = REGIONS[region];
  const materials = product === 'pc-office-packaged'
    ? saleOffer('office', null, context.era)?.unitMaterialCents ?? 0
    : Object.entries(PRODUCT_INPUTS[product]).reduce((total, [item, count]) => total + materialPrice(item as ItemType) * (count ?? 0), 0);
  return Math.ceil(materials * materialPercent / 100) + Math.ceil(PRODUCT_LINES[product].laborCents * wagePercent / 100);
}

export function overhead(region: RegionId): number {
  return Math.ceil(ABROAD.overheadCents * REGIONS[region].wagePercent / 100);
}

export function freightCost(region: RegionId, product: SubsidiaryProduct, mode: TransportMode, units: number): number {
  return Math.ceil(REGIONS[region].freightCentsPerKg[mode] * PRODUCT_LINES[product].weightKg * units);
}

/** Reference price at home: the wholesale price, or a PC at its contract price for its era. */
function referencePrice(product: SubsidiaryProduct, context: AbroadContext): number {
  if (product === 'pc-office-packaged') return Math.ceil((saleOffer('office').unitPriceCents) * obsolescence(context.behind) / 100);
  return MARKET_PRICES[product] ?? 0;
}

/** Price the home wholesaler pays for a unit, moved by the home market index. */
export function homePrice(product: SubsidiaryProduct, context: AbroadContext): number {
  const index = context.prices?.[marketOfProduct(product)] ?? 100;
  return Math.ceil(referencePrice(product, context) * index / 100);
}

/** Local markets abroad are not shared with the home rivals: their price follows the reference. */
export function localPrice(region: RegionId, product: SubsidiaryProduct, context: AbroadContext): number {
  return Math.floor(referencePrice(product, context) * REGIONS[region].marketPercent / 100);
}

export function transitTicks(region: RegionId, mode: TransportMode): number {
  return REGIONS[region].days[mode] * ABROAD.dayTicks;
}

/** Everything a month of production costs: overhead, units and, when shipped home, freight. */
export function monthlyCost(subsidiary: Pick<Subsidiary, 'region' | 'product' | 'destination' | 'mode'>, context: AbroadContext): number {
  const { region, product } = subsidiary;
  if (!product) return overhead(region);
  const { unitsPerMonth } = PRODUCT_LINES[product];
  const freight = subsidiary.destination === 'local' ? 0 : freightCost(region, product, subsidiary.mode, unitsPerMonth);
  return overhead(region) + unitCost(region, product, context) * unitsPerMonth + freight;
}

/** Monthly result of a factory if every unit sells: revenue minus monthly cost. */
export function monthlyMargin(subsidiary: Pick<Subsidiary, 'region' | 'product' | 'destination' | 'mode'>, context: AbroadContext): number {
  const { region, product } = subsidiary;
  if (!product) return -overhead(region);
  const units = PRODUCT_LINES[product].unitsPerMonth;
  const price = subsidiary.destination === 'local' ? localPrice(region, product, context) : homePrice(product, context);
  return units * price - monthlyCost(subsidiary, context);
}

/** A region opens on 1 January of its year; the home region never has a factory abroad. */
export function regionOpen(region: RegionId, startYear: number, tick: number): boolean {
  return region !== 'western-europe' && REGION_IDS.includes(region) && REGIONS[region].openYear <= dateAt(startYear, tick).year;
}

export function validSubsidiarySettings(settings: Pick<Subsidiary, 'product' | 'destination' | 'mode' | 'dockId'>): boolean {
  return (settings.product === null || SUBSIDIARY_PRODUCTS.includes(settings.product)) &&
    SUBSIDIARY_DESTINATIONS.includes(settings.destination) && TRANSPORT_MODES.includes(settings.mode) &&
    (settings.destination === 'dock') === (settings.dockId !== null) &&
    (settings.dockId === null || (Number.isSafeInteger(settings.dockId) && settings.dockId > 0));
}

/** Units of a delivery the dock can take now, and the world update, provided by the workshop. */
export interface DockAccess {
  readonly space: (dockId: number) => number;
  readonly deliver: (dockId: number, item: ItemType, units: number) => void;
}

/**
 * Runs the factories abroad for one tick. A month is paid in full or not at all: an unpaid factory
 * makes nothing. Shipments reach the home wholesaler or a dock on their due tick; a full dock waits.
 */
export function advanceAbroad(
  abroad: AbroadState, tick: number, capitalCents: number, context: AbroadContext, docks: DockAccess,
): { abroad: AbroadState; capitalCents: number; sold: Inventory } {
  let next = abroad;
  let capital = capitalCents;
  let sold: Inventory = {};
  if (abroad.subsidiaries.some(subsidiary => tick >= subsidiary.nextRun)) {
    const shipments = [...next.shipments];
    let { nextShipmentId, spentCents, revenueCents } = next;
    const subsidiaries = next.subsidiaries.map(subsidiary => {
      if (tick < subsidiary.nextRun) return subsidiary;
      const cost = monthlyCost(subsidiary, context);
      const nextRun = subsidiary.nextRun + ABROAD.dayTicks * 30;
      if (capital < cost) return { ...subsidiary, nextRun, idle: true };
      capital -= cost;
      spentCents += cost;
      const { product } = subsidiary;
      if (product) {
        const units = PRODUCT_LINES[product].unitsPerMonth;
        if (subsidiary.destination === 'local') {
          const revenue = units * localPrice(subsidiary.region, product, context);
          capital += revenue;
          revenueCents += revenue;
        } else {
          shipments.push({
            id: nextShipmentId, region: subsidiary.region, item: product, units, destination: subsidiary.destination,
            dockId: subsidiary.dockId, dueTick: tick + transitTicks(subsidiary.region, subsidiary.mode),
          });
          nextShipmentId += 1;
        }
      }
      return { ...subsidiary, nextRun, idle: false };
    });
    next = { ...next, subsidiaries, shipments, nextShipmentId, spentCents, revenueCents };
  }
  if (next.shipments.some(shipment => tick >= shipment.dueTick)) {
    let { revenueCents, imported } = next;
    const shipments: Shipment[] = [];
    for (const shipment of next.shipments) {
      if (tick < shipment.dueTick) {
        shipments.push(shipment);
        continue;
      }
      const dock = shipment.destination === 'dock' && shipment.dockId !== null ? shipment.dockId : null;
      if (dock !== null && docks.space(dock) >= 0) {
        const room = docks.space(dock);
        if (room >= shipment.units) {
          docks.deliver(dock, shipment.item, shipment.units);
          imported = addItems(imported, shipment.item, shipment.units);
        } else {
          shipments.push({ ...shipment, dueTick: tick + ABROAD.retryTicks });
        }
        continue;
      }
      // Sold to the home wholesaler, also when the chosen dock was demolished.
      const revenue = shipment.units * homePrice(shipment.item, context);
      capital += revenue;
      revenueCents += revenue;
      sold = addItems(sold, shipment.item, shipment.units);
    }
    next = { ...next, shipments, revenueCents, imported };
  }
  return { abroad: next, capitalCents: capital, sold };
}
