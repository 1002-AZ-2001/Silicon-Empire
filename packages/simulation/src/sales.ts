import { saleOffer } from '@silicon-empire/game-data';
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

export function validSaleTerms(terms: SaleTerms): boolean {
  const offer = saleOffer(terms.model);
  return terms.revision === offer.revision && terms.item === offer.item && terms.units === offer.units &&
    terms.unitPriceCents === offer.unitPriceCents && terms.unitMaterialCents === offer.unitMaterialCents;
}
