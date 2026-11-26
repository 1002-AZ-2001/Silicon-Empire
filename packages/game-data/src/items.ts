import { z } from 'zod';

export const ITEM_CATEGORIES = [
  'cpu', 'gpu', 'ram', 'storage', 'motherboard', 'power-supply', 'case', 'packaging', 'product',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Order of this list is the stable order used when a machine releases mixed stock. */
export const ITEM_TYPES = [
  'cpu-8c', 'gpu-8g', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard', 'carton',
  'ram-32g', 'ssd-2t',
  'pc-office', 'pc-office-tested', 'pc-office-packaged',
  'pc-gaming', 'pc-gaming-tested', 'pc-gaming-packaged',
  'pc-professional', 'pc-professional-tested', 'pc-professional-packaged', 'pc-professional-rejected',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Purchases are delivered at once to a receiving dock, in lots of `lotSize` identical units. */
export const PURCHASE = { lotSize: 10 } as const;

/** Display names are translated in the game interface (apps/web/src/i18n). */
const itemDefinition = z.strictObject({
  category: z.enum(ITEM_CATEGORIES),
  /** Fictional manufacturer, or the workshop for its own products. */
  manufacturer: z.string().min(1),
  /** Supplier price; null for products made in the workshop, which cannot be bought. */
  unitCostCents: z.int().positive().nullable(),
});

export const ITEMS = z.record(z.enum(ITEM_TYPES), itemDefinition.readonly()).readonly().parse({
  'cpu-8c': {
    category: 'cpu',
    manufacturer: 'Arkelis',
    unitCostCents: 18_000,
  },
  'gpu-8g': {
    category: 'gpu',
    manufacturer: 'Voltrane',
    unitCostCents: 23_000,
  },
  'ram-16g': {
    category: 'ram',
    manufacturer: 'Mnemora',
    unitCostCents: 4_000,
  },
  'ssd-1t': {
    category: 'storage',
    manufacturer: 'Stratavault',
    unitCostCents: 5_500,
  },
  'motherboard-atx': {
    category: 'motherboard',
    manufacturer: 'Ferrolux',
    unitCostCents: 9_500,
  },
  'psu-650': {
    category: 'power-supply',
    manufacturer: 'Kelvane',
    unitCostCents: 5_500,
  },
  'case-standard': {
    category: 'case',
    manufacturer: 'Carrène',
    unitCostCents: 4_500,
  },
  carton: {
    category: 'packaging',
    manufacturer: 'Embalis',
    unitCostCents: 300,
  },
  'ram-32g': {
    category: 'ram',
    manufacturer: 'Mnemora',
    unitCostCents: 9_500,
  },
  'ssd-2t': {
    category: 'storage',
    manufacturer: 'Stratavault',
    unitCostCents: 10_000,
  },
  'pc-office': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-office-tested': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-office-packaged': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-gaming': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-gaming-tested': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-gaming-packaged': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-professional': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-professional-tested': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-professional-packaged': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
  'pc-professional-rejected': {
    category: 'product',
    manufacturer: 'Silicon Empire',
    unitCostCents: null,
  },
} satisfies Record<ItemType, z.input<typeof itemDefinition>>);
