import { LAND, MACHINES } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, createWorld, landSpent, ownedBounds, ownsTile, parcelBounds, parcelForSale, parcelOf, parcelPrice,
} from '../src';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

describe('parcelles', () => {
  it('numérote les parcelles ligne par ligne et part des quatre parcelles nord-ouest', () => {
    const world = createWorld();
    expect(parcelOf({ x: 0, y: 0 })).toBe(0);
    expect(parcelOf({ x: 63, y: 63 })).toBe(5);
    expect(parcelOf({ x: 64, y: 0 })).toBe(2);
    expect(parcelOf({ x: 127, y: 127 })).toBe(15);
    expect(parcelBounds(6)).toEqual({ x: 64, y: 32, width: 32, height: 32 });
    expect(ownedBounds(world)).toEqual({ x: 0, y: 0, width: 64, height: 64 });
    expect(ownsTile(world, { x: 63, y: 63 })).toBe(true);
    expect(ownsTile(world, { x: 64, y: 63 })).toBe(false);
    expect([2, 6, 8, 9].every(parcel => parcelForSale(world, parcel))).toBe(true);
    expect([0, 3, 10, 15, -1, 16].some(parcel => parcelForSale(world, parcel))).toBe(false);
  });

  it('achète une parcelle voisine, de plus en plus cher, puis y construit', () => {
    let world = createWorld();
    expect(parcelPrice(world)).toBe(LAND.firstPriceCents);
    world = run(world, { kind: 'buy-parcel', parcel: 2 });
    expect(world.parcels).toEqual([0, 1, 2, 4, 5]);
    expect(world.capitalCents).toBe(createWorld().capitalCents - LAND.firstPriceCents);
    expect(parcelPrice(world)).toBe(LAND.firstPriceCents + LAND.priceStepCents);
    expect(parcelForSale(world, 3)).toBe(true);
    world = run(world, { kind: 'build', type: 'tester', x: 70, y: 10, rotation: 0 });
    expect(world.capitalCents).toBe(createWorld().capitalCents - LAND.firstPriceCents - MACHINES.tester.costCents);
    expect(landSpent(world)).toBe(LAND.firstPriceCents);
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, { kind: 'buy-parcel', parcel: 2 })).toEqual({ ok: false, reason: 'parcel-unavailable' });
    expect(applyCommand(world, { kind: 'buy-parcel', parcel: 15 })).toEqual({ ok: false, reason: 'parcel-unavailable' });
    expect(applyCommand({ ...world, capitalCents: 0 }, { kind: 'buy-parcel', parcel: 3 })).toEqual({ ok: false, reason: 'insufficient-funds' });
    const total = LAND.firstPriceCents * 3 + LAND.priceStepCents * 3;
    const rich = { ...world, capitalCents: 10_000_000 };
    expect(landSpent(run(run(rich, { kind: 'buy-parcel', parcel: 3 }), { kind: 'buy-parcel', parcel: 6 }))).toBe(total);
  });

  it('ouvre l’achat au jalon Entrepôt en progression', () => {
    const progression = createWorld('progression');
    expect(applyCommand(progression, { kind: 'buy-parcel', parcel: 2 })).toEqual({ ok: false, reason: 'locked' });
    const warehouse = { ...progression, progress: { ...progression.progress, completed: [LAND.requiredFrom] } };
    expect(applyCommand(warehouse, { kind: 'buy-parcel', parcel: 2 }).ok).toBe(true);
  });

  it('refuse des parcelles non contiguës ou un bâtiment hors des parcelles', () => {
    const world = createWorld();
    expect(checkIntegrity({ ...world, parcels: [0, 1, 4, 5, 15] })).toBe(false);
    expect(checkIntegrity({ ...world, parcels: [0, 1, 4] })).toBe(false);
    expect(checkIntegrity({ ...world, parcels: [1, 0, 4, 5] })).toBe(false);
    const built = run(run(world, { kind: 'buy-parcel', parcel: 2 }), { kind: 'build', type: 'storage', x: 70, y: 10, rotation: 0 });
    expect(checkIntegrity({ ...built, parcels: world.parcels, capitalCents: built.capitalCents + LAND.firstPriceCents })).toBe(false);
  });
});
