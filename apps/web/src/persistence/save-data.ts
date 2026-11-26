import {
  CONVEYOR, ITEM_TYPES, MACHINE_TYPES, MILESTONE_IDS, PRODUCT_MODELS, RESEARCH_IDS, STANDARD_MODELS, SUPPLIER_IDS, WORKSHOP,
  publishedDesignSchema,
} from '@silicon-empire/game-data';
import { ROTATIONS, ROUTER_SIDES, checkIntegrity } from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 9;
export const MAX_WORKSHOP_NAME = 40;

export function createSaveId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface SaveRecord {
  readonly version: typeof SAVE_VERSION;
  readonly id: string;
  readonly name: string;
  readonly createdAt: number;
  readonly savedAt: number;
  readonly world: World;
}

const safeDate = z.int().nonnegative().max(8_640_000_000_000_000);
const count = z.int().positive().max(Number.MAX_SAFE_INTEGER);
const machineId = z.string().regex(/^[1-9][0-9]{0,15}$/);
const inventory = z.partialRecord(z.enum(ITEM_TYPES), count);

const machineV1 = z.strictObject({
  id: z.int().positive(),
  type: z.enum(MACHINE_TYPES),
  x: z.int().nonnegative(),
  y: z.int().nonnegative(),
  rotation: z.union(ROTATIONS.map(rotation => z.literal(rotation))),
  paidCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
});

const machine = machineV1.extend({
  /** The headquarters is free to build. */
  paidCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  filter: z.strictObject({ item: z.enum(ITEM_TYPES), output: z.enum(ROUTER_SIDES) }).optional(),
});

const header = {
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().trim().min(1).max(MAX_WORKSHOP_NAME),
  createdAt: safeDate,
  savedAt: safeDate,
};

const layoutV1 = {
  columns: z.literal(WORKSHOP.columns),
  rows: z.literal(WORKSHOP.rows),
  capitalCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  nextMachineId: z.int().positive(),
  machines: z.array(machineV1).max(WORKSHOP.columns * WORKSHOP.rows),
};

/** Version 1 (v0.1.0): construction only. */
const saveV1 = z.strictObject({
  version: z.literal(1),
  ...header,
  world: z.strictObject(layoutV1),
});

const unit = { id: z.int().positive(), item: z.enum(ITEM_TYPES) };

/** Version 2 (v0.2.0): clock, purchases, inventories and conveyor contents. */
const worldV2 = {
  ...layoutV1,
  tick: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  nextItemId: z.int().positive().max(Number.MAX_SAFE_INTEGER),
  stocks: z.record(machineId, inventory),
  belts: z.record(machineId, z.array(z.strictObject({
    ...unit,
    position: z.int().nonnegative().max(CONVEYOR.lengthUnits - 1),
  }))),
  ledger: z.strictObject({
    purchased: inventory,
    discarded: inventory,
    purchaseSpentCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  }),
};

const saveV2 = z.strictObject({
  version: z.literal(2),
  ...header,
  world: z.strictObject(worldV2),
});

/** Version 3 (v0.2.1): splitters, mergers and splitter filters. */
const worldV3 = {
  ...worldV2,
  machines: z.array(machine).max(WORKSHOP.columns * WORKSHOP.rows),
  routers: z.record(machineId, z.strictObject({
    held: z.strictObject(unit).nullable(),
    cursor: z.int().min(0).max(2),
  })),
};

const saveV3 = z.strictObject({
  version: z.literal(3),
  ...header,
  world: z.strictObject(worldV3),
});

const milestoneId = z.enum(MILESTONE_IDS);

/** Version 4 (v0.3.0): production machines, progression and the extended ledger. */
const worldV4 = {
  ...worldV3,
  production: z.record(machineId, z.strictObject({
    batch: z.strictObject({
      item: z.enum(ITEM_TYPES),
      remaining: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    }).nullable(),
    output: inventory,
  })),
  progress: z.strictObject({
    sandbox: z.boolean(),
    completed: z.array(milestoneId).max(MILESTONE_IDS.length),
    active: milestoneId.nullable(),
    delivered: z.partialRecord(milestoneId, inventory),
  }),
  capitalCents: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ledger: z.strictObject({
    purchased: inventory,
    discarded: inventory,
    purchaseSpentCents: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    produced: inventory,
    consumed: inventory,
    delivered: inventory,
  }),
};

const saveV4 = z.strictObject({
  version: z.literal(4),
  ...header,
  world: z.strictObject(worldV4),
});

/** Version 5: the model chosen for each production machine. */
const saveV5 = z.strictObject({
  version: z.literal(5),
  ...header,
  world: z.strictObject({
    ...worldV4,
    machines: z.array(machine.extend({ model: z.enum(['office', 'gaming']).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
  }),
});

/** Version 6 supports professional models and PCs routed to the reject output. */
const worldV6 = {
  ...worldV4,
  machines: z.array(machine.extend({ model: z.enum(STANDARD_MODELS).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
};

const saveV6 = z.strictObject({
  version: z.literal(6),
  ...header,
  world: z.strictObject(worldV6),
});

const standardTerms = z.strictObject({
  model: z.enum(STANDARD_MODELS),
  revision: z.int().positive(),
  item: z.enum(ITEM_TYPES),
  units: z.int().positive(),
  unitPriceCents: z.int().positive(),
  unitMaterialCents: z.int().positive(),
});

const saveV7 = z.strictObject({
  version: z.literal(7),
  ...header,
  world: z.strictObject({
    ...worldV6,
    sales: z.strictObject({
      active: z.strictObject({ terms: standardTerms, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(standardTerms),
    }),
  }),
});

const saleTerms = standardTerms.extend({
  model: z.enum(PRODUCT_MODELS),
  design: publishedDesignSchema.optional(),
});

const saveV8 = z.strictObject({
  version: z.literal(8),
  ...header,
  world: z.strictObject({
    ...worldV6,
    machines: z.array(machine.extend({ model: z.enum(PRODUCT_MODELS).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
    sales: z.strictObject({
      active: z.strictObject({ terms: saleTerms, delivered: z.int().nonnegative() }).nullable(),
      completed: z.array(saleTerms),
    }),
    design: publishedDesignSchema.nullable(),
    deliveries: z.array(z.strictObject({
      dockId: z.int().positive(), dueTick: z.int().positive(), item: z.enum(ITEM_TYPES), supplier: z.enum(SUPPLIER_IDS),
    })),
  }),
});

function migrateV1(value: unknown): z.input<typeof saveV2> | null {
  const v1 = saveV1.safeParse(value);
  if (!v1.success) return null;
  const { data } = v1;
  return {
    ...data,
    version: 2,
    world: {
      ...data.world,
      tick: 0,
      nextItemId: 1,
      stocks: {},
      belts: {},
      ledger: { purchased: {}, discarded: {}, purchaseSpentCents: 0 },
    },
  };
}

function migrateV2(value: unknown): z.input<typeof saveV3> | null {
  const v2 = saveV2.safeParse(value);
  if (!v2.success) return null;
  const { data } = v2;
  return { ...data, version: 3, world: { ...data.world, routers: {} } };
}

/** Workshops built before the progression keep every building: they become sandbox games. */
function migrateV3(value: unknown): z.input<typeof saveV4> | null {
  const v3 = saveV3.safeParse(value);
  if (!v3.success) return null;
  const { data } = v3;
  return {
    ...data,
    version: 4,
    world: {
      ...data.world,
      production: {},
      progress: { sandbox: true, completed: [], active: null, delivered: {} },
      ledger: { ...data.world.ledger, produced: {}, consumed: {}, delivered: {} },
    },
  };
}

function migrateV4(value: unknown): z.input<typeof saveV5> | null {
  const v4 = saveV4.safeParse(value);
  if (!v4.success) return null;
  // Unconfigured machines continue their office recipes, including batches already in progress.
  return { ...v4.data, version: 5 };
}

function migrateV5(value: unknown): z.input<typeof saveV6> | null {
  const v5 = saveV5.safeParse(value);
  return v5.success ? { ...v5.data, version: 6 } : null;
}

function migrateV6(value: unknown): z.input<typeof saveV7> | null {
  const v6 = saveV6.safeParse(value);
  return v6.success
    ? { ...v6.data, version: 7, world: { ...v6.data.world, sales: { active: null, completed: [] } } }
    : null;
}

const researchId = z.enum(RESEARCH_IDS);

/** Version 9 (v0.6.0): research and Mk2 machines. */
const saveV9 = z.strictObject({
  version: z.literal(SAVE_VERSION),
  ...header,
  world: z.strictObject({
    ...saveV8.shape.world.shape,
    machines: z.array(machine.extend({
      model: z.enum(PRODUCT_MODELS).optional(),
      level: z.literal(2).optional(),
    })).max(WORKSHOP.columns * WORKSHOP.rows),
    research: z.strictObject({
      active: researchId.nullable(),
      delivered: z.partialRecord(researchId, inventory),
      analysing: z.strictObject({ id: researchId, remaining: z.int().positive() }).nullable(),
      completed: z.array(researchId).max(RESEARCH_IDS.length),
    }),
  }),
});

function migrateV7(value: unknown): z.input<typeof saveV8> | null {
  const v7 = saveV7.safeParse(value);
  return v7.success
    ? { ...v7.data, version: 8, world: { ...v7.data.world, design: null, deliveries: [] } }
    : null;
}

function migrateV8(value: unknown): z.input<typeof saveV9> | null {
  const v8 = saveV8.safeParse(value);
  return v8.success
    ? {
      ...v8.data,
      version: SAVE_VERSION,
      world: { ...v8.data.world, research: { active: null, delivered: {}, analysing: null, completed: [] } },
    }
    : null;
}

const migrations = [migrateV1, migrateV2, migrateV3, migrateV4, migrateV5, migrateV6, migrateV7, migrateV8];

function versionOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined;
}

/** Reads a stored record, migrating older versions. Returns null when the record is unusable. */
export function decodeSave(value: unknown): SaveRecord | null {
  const version = versionOf(value);
  let current = value;
  if (typeof version === 'number' && Number.isInteger(version) && version >= 1) {
    for (const migrate of migrations.slice(version - 1)) current = migrate(current);
  }
  const decoded = saveV9.safeParse(current);
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt) return null;
  try {
    return checkIntegrity(data.world) ? data : null;
  } catch (error) {
    // A malformed ledger can overflow the safe integer range when quantities are combined.
    if (error instanceof RangeError) return null;
    throw error;
  }
}
