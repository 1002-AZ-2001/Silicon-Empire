import { CONVEYOR, ITEM_TYPES, MACHINE_TYPES, WORKSHOP } from '@silicon-empire/game-data';
import { ROTATIONS, checkIntegrity } from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 2;
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

const machine = z.strictObject({
  id: z.int().positive(),
  type: z.enum(MACHINE_TYPES),
  x: z.int().nonnegative(),
  y: z.int().nonnegative(),
  rotation: z.union(ROTATIONS.map(rotation => z.literal(rotation))),
  paidCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
});

const header = {
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().trim().min(1).max(MAX_WORKSHOP_NAME),
  createdAt: safeDate,
  savedAt: safeDate,
};

const layout = {
  columns: z.literal(WORKSHOP.columns),
  rows: z.literal(WORKSHOP.rows),
  capitalCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  nextMachineId: z.int().positive(),
  machines: z.array(machine).max(WORKSHOP.columns * WORKSHOP.rows),
};

/** Version 1 (v0.1.0): construction only. */
const saveV1 = z.strictObject({
  version: z.literal(1),
  ...header,
  world: z.strictObject(layout),
});

/** Version 2 (v0.2): clock, purchases, inventories and conveyor contents. */
const saveV2 = z.strictObject({
  version: z.literal(SAVE_VERSION),
  ...header,
  world: z.strictObject({
    ...layout,
    tick: z.int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    nextItemId: z.int().positive().max(Number.MAX_SAFE_INTEGER),
    stocks: z.record(machineId, inventory),
    belts: z.record(machineId, z.array(z.strictObject({
      id: z.int().positive(),
      item: z.enum(ITEM_TYPES),
      position: z.int().nonnegative().max(CONVEYOR.lengthUnits - 1),
    }))),
    ledger: z.strictObject({
      purchased: inventory,
      discarded: inventory,
      purchaseSpentCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
    }),
  }),
});

function migrate(value: unknown): z.input<typeof saveV2> | null {
  const v1 = saveV1.safeParse(value);
  if (!v1.success) return null;
  const { data } = v1;
  return {
    ...data,
    version: SAVE_VERSION,
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

/** Reads a stored record, migrating older versions. Returns null when the record is unusable. */
export function decodeSave(value: unknown): SaveRecord | null {
  const decoded = saveV2.safeParse(
    typeof value === 'object' && value !== null && 'version' in value && value.version === 1 ? migrate(value) : value,
  );
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt || !checkIntegrity(data.world)) return null;
  return data;
}
