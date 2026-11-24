import { ITEM_TYPES } from '@silicon-empire/game-data';
import type { ItemType } from '@silicon-empire/game-data';

/** Unit counts by item type. Only positive counts are stored. */
export type Inventory = Readonly<Partial<Record<ItemType, number>>>;

export function inventoryTotal(inventory: Inventory): number {
  return ITEM_TYPES.reduce((total, item) => total + (inventory[item] ?? 0), 0);
}

export function addItems(inventory: Inventory, item: ItemType, count: number): Inventory {
  const next = (inventory[item] ?? 0) + count;
  if (next < 0 || !Number.isSafeInteger(next)) throw new RangeError(`Quantité invalide pour ${item}.`);
  const copy = { ...inventory };
  if (next === 0) delete copy[item];
  else copy[item] = next;
  return copy;
}

export function mergeInventories(first: Inventory, second: Inventory): Inventory {
  return ITEM_TYPES.reduce((total, item) => {
    const count = second[item] ?? 0;
    return count === 0 ? total : addItems(total, item, count);
  }, first);
}

/** First item type with stock, in catalogue order. */
export function firstItem(inventory: Inventory): ItemType | undefined {
  return ITEM_TYPES.find(item => (inventory[item] ?? 0) > 0);
}
