import { CONVEYOR, ITEM_TYPES, MACHINE_TYPES, MILESTONE_IDS, PRODUCT_MODELS, WORKSHOP } from '@silicon-empire/game-data';
import { ROTATIONS, ROUTER_SIDES, checkIntegrity } from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 5;
export const MAX_WORKSHOP_NAME = 40;

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
  version: z.literal(SAVE_VERSION),
  ...header,
  world: z.strictObject({
    ...worldV4,
    machines: z.array(machine.extend({ model: z.enum(PRODUCT_MODELS).optional() })).max(WORKSHOP.columns * WORKSHOP.rows),
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
  return { ...v4.data, version: SAVE_VERSION };
}

function versionOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined;
}

/** Reads a stored record, migrating older versions. Returns null when the record is unusable. */
export function decodeSave(value: unknown): SaveRecord | null {
  const version = versionOf(value);
  const legacy = version === 1 ? migrateV3(migrateV2(migrateV1(value)))
    : version === 2 ? migrateV3(migrateV2(value))
      : version === 3 ? migrateV3(value)
        : value;
  const current = version === SAVE_VERSION ? value : migrateV4(legacy);
  const decoded = saveV5.safeParse(current);
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt || !checkIntegrity(data.world)) return null;
  return data;
}
