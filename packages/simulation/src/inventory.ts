import { ITEM_TYPES, PRODUCTION } from '@silicon-empire/game-data';
import type { ItemType, Recipe } from '@silicon-empire/game-data';

/** Unit counts by item type. Only positive counts are stored. */
export type Inventory = Readonly<Partial<Record<ItemType, number>>>;

/** Units of this ingredient a production machine can still accept. */
export function inputRoom(recipe: Recipe, stock: Inventory, item: ItemType): number {
  const perBatch = recipe.inputs[item] ?? 0;
  return perBatch * PRODUCTION.inputBatches - (stock[item] ?? 0);
}

export function fitsInputStock(recipe: Recipe, stock: Inventory): boolean {
  return ITEM_TYPES.every(item => inputRoom(recipe, stock, item) >= 0);
}

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

/**
 * Item type with the most units, ties broken by catalogue order. Machines release this one first,
 * so a mixed stock leaves in alternation instead of one type after another.
 */
export function mostStocked(inventory: Inventory): ItemType | undefined {
  let best: ItemType | undefined;
  for (const item of ITEM_TYPES) {
    if ((inventory[item] ?? 0) > (best ? inventory[best] ?? 0 : 0)) best = item;
  }
  return best;
}
