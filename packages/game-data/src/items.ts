import { z } from 'zod';

export const ITEM_CATEGORIES = [
  'cpu', 'gpu', 'ram', 'storage', 'motherboard', 'power-supply', 'case',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  cpu: 'Processeur',
  gpu: 'Carte graphique',
  ram: 'Mémoire vive',
  storage: 'Stockage',
  motherboard: 'Carte mère',
  'power-supply': 'Alimentation',
  case: 'Boîtier',
};

/** Order of this list is the stable order used when a machine releases mixed stock. */
export const ITEM_TYPES = [
  'cpu-8c', 'gpu-8g', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

/** Purchases are delivered at once to a receiving dock, in lots of `lotSize` identical units. */
export const PURCHASE = { lotSize: 10 } as const;

const itemDefinition = z.strictObject({
  name: z.string().min(1),
  category: z.enum(ITEM_CATEGORIES),
  /** Fictional manufacturer. */
  manufacturer: z.string().min(1),
  unitCostCents: z.int().positive(),
});

export const ITEMS = z.record(z.enum(ITEM_TYPES), itemDefinition.readonly()).readonly().parse({
  'cpu-8c': {
    name: 'Processeur 8 cœurs K8',
    category: 'cpu',
    manufacturer: 'Arkelis',
    unitCostCents: 18_000,
  },
  'gpu-8g': {
    name: 'Carte graphique 8 Go V8',
    category: 'gpu',
    manufacturer: 'Voltrane',
    unitCostCents: 23_000,
  },
  'ram-16g': {
    name: 'Barrette 16 Go',
    category: 'ram',
    manufacturer: 'Mnemora',
    unitCostCents: 4_000,
  },
  'ssd-1t': {
    name: 'SSD 1 To',
    category: 'storage',
    manufacturer: 'Stratavault',
    unitCostCents: 5_500,
  },
  'motherboard-atx': {
    name: 'Carte mère ATX B4',
    category: 'motherboard',
    manufacturer: 'Ferrolux',
    unitCostCents: 9_500,
  },
  'psu-650': {
    name: 'Alimentation 650 W',
    category: 'power-supply',
    manufacturer: 'Kelvane',
    unitCostCents: 5_500,
  },
  'case-standard': {
    name: 'Boîtier standard',
    category: 'case',
    manufacturer: 'Carrène',
    unitCostCents: 4_500,
  },
} satisfies Record<ItemType, z.input<typeof itemDefinition>>);
