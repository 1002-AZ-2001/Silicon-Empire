import { CALENDAR, ERA_IDS, ROLE_EFFECTS, designPower, saleOffer } from '@silicon-empire/game-data';
import { addItems } from './inventory';
import type { ItemType, SaleTerms } from '@silicon-empire/game-data';
import type { Inventory } from './inventory';

export interface SaleOrder {
  readonly terms: SaleTerms;
  readonly delivered: number;
}

export interface Sales {
  readonly active: SaleOrder | null;
  readonly completed: readonly SaleTerms[];
}

export function acceptsSale(sales: Sales, item: ItemType): boolean {
  const order = sales.active;
  return order !== null && order.terms.item === item && order.delivered < order.terms.units;
}

export function salesAccounts({ active, completed }: Sales) {
  let revenueCents = 0;
  let materialCents = 0;
  let shipped: Inventory = active && active.delivered > 0 ? { [active.terms.item]: active.delivered } : {};
  for (const terms of completed) {
    revenueCents += terms.units * terms.unitPriceCents;
    materialCents += terms.units * terms.unitMaterialCents;
    shipped = addItems(shipped, terms.item, terms.units);
  }
  return { revenueCents, materialCents, shipped };
}

const HISTORICAL_ERAS: readonly string[] = ERA_IDS.filter(era => era !== 'modern');

export function validSaleTerms(terms: SaleTerms): boolean {
  if (terms.model === 'custom') {
    if (!terms.design) return false;
    const power = designPower(terms.design.spec);
    if (power.required > power.available) return false;
  } else if (terms.design) return false;
  if (terms.era !== undefined && (!HISTORICAL_ERAS.includes(terms.era) || terms.model === 'custom')) return false;
  const offer = saleOffer(terms.model, terms.design, terms.era);
  if (!offer) return false;
  // Career PCs of a historical era sell below the catalogue price once a later era is on sale.
  const lowest = terms.era === undefined ? offer.unitPriceCents : Math.floor(offer.unitPriceCents * CALENDAR.minPricePercent / 100);
  return terms.revision === offer.revision && terms.item === offer.item && terms.units === offer.units &&
    terms.unitMaterialCents === offer.unitMaterialCents && terms.unitPriceCents >= lowest &&
    // Salespeople can raise the catalogue price by up to the largest sales bonus.
    terms.unitPriceCents <= Math.ceil(offer.unitPriceCents * (100 + ROLE_EFFECTS.maxSales * ROLE_EFFECTS.salesPercent) / 100);
}
