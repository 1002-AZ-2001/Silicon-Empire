import { CONVEYOR, ITEM_TYPES, MACHINE_TYPES, WORKSHOP } from '@silicon-empire/game-data';
import { ROTATIONS, ROUTER_SIDES, checkIntegrity } from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 3;
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
const saveV3 = z.strictObject({
  version: z.literal(SAVE_VERSION),
  ...header,
  world: z.strictObject({
    ...worldV2,
    machines: z.array(machine).max(WORKSHOP.columns * WORKSHOP.rows),
    routers: z.record(machineId, z.strictObject({
      held: z.strictObject(unit).nullable(),
      cursor: z.int().min(0).max(2),
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
  return { ...data, version: SAVE_VERSION, world: { ...data.world, routers: {} } };
}

function versionOf(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'version' in value ? value.version : undefined;
}

/** Reads a stored record, migrating older versions. Returns null when the record is unusable. */
export function decodeSave(value: unknown): SaveRecord | null {
  const version = versionOf(value);
  const current = version === 1 ? migrateV2(migrateV1(value)) : version === 2 ? migrateV2(value) : value;
  const decoded = saveV3.safeParse(current);
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt || !checkIntegrity(data.world)) return null;
  return data;
}
