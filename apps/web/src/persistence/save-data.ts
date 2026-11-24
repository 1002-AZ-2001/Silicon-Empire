import { MACHINE_TYPES, WORKSHOP } from '@silicon-empire/game-data';
import { ROTATIONS, fitsMap, footprintOf } from '@silicon-empire/simulation';
import { z } from 'zod';
import type { World } from '@silicon-empire/simulation';

export const SAVE_VERSION = 1;
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
const snapshotSchema = z.strictObject({
  version: z.literal(SAVE_VERSION),
  id: z.string().regex(/^[0-9a-f]{32}$/),
  name: z.string().trim().min(1).max(MAX_WORKSHOP_NAME),
  createdAt: safeDate,
  savedAt: safeDate,
  world: z.strictObject({
    columns: z.literal(WORKSHOP.columns),
    rows: z.literal(WORKSHOP.rows),
    capitalCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
    nextMachineId: z.int().positive(),
    machines: z.array(z.strictObject({
      id: z.int().positive(),
      type: z.enum(MACHINE_TYPES),
      x: z.int().nonnegative(),
      y: z.int().nonnegative(),
      rotation: z.union(ROTATIONS.map(rotation => z.literal(rotation))),
      paidCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
    })).max(WORKSHOP.columns * WORKSHOP.rows),
  }),
});

export function decodeSave(value: unknown): SaveRecord | null {
  const decoded = snapshotSchema.safeParse(value);
  if (!decoded.success) return null;

  const { data } = decoded;
  if (data.savedAt < data.createdAt) return null;

  const { world } = data;
  const occupiedTiles = new Set<number>();
  const ids = new Set<number>();
  let bookedCapital = world.capitalCents;

  for (const machine of world.machines) {
    const footprint = footprintOf(machine);
    if (ids.has(machine.id) || machine.id >= world.nextMachineId || !fitsMap(world, footprint)) {
      return null;
    }
    ids.add(machine.id);
    bookedCapital += machine.paidCents;
    if (bookedCapital > WORKSHOP.initialCapitalCents) return null;

    for (let y = footprint.y; y < footprint.y + footprint.height; y++) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x++) {
        const index = y * world.columns + x;
        if (occupiedTiles.has(index)) return null;
        occupiedTiles.add(index);
      }
    }
  }

  return data;
}
