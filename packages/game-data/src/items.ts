import { z } from 'zod';

export const ITEM_CATEGORIES = [
  'cpu', 'gpu', 'ram', 'storage', 'motherboard', 'power-supply', 'case',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

/** Order of this list is the stable order used when a machine releases mixed stock. */
export const ITEM_TYPES = [
  'cpu-8c', 'gpu-8g', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Purchases are delivered at once to a receiving dock, in lots of `lotSize` identical units. */
export const PURCHASE = { lotSize: 10 } as const;

/** Display names are translated in the game interface (apps/web/src/i18n). */
const itemDefinition = z.strictObject({
  category: z.enum(ITEM_CATEGORIES),
  /** Fictional manufacturer. */
  manufacturer: z.string().min(1),
  unitCostCents: z.int().positive(),
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
} satisfies Record<ItemType, z.input<typeof itemDefinition>>);
