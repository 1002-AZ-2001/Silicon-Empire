import { FLOOR_COST_CENTS, MACHINES, PROFESSIONAL_RECIPES, ROOMS, STAFF } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, breakRoomSeats, candidatesFor, checkIntegrity, createWorld, inCleanRoom, plantMorale, poolSizeOf, rejectionFor, roomOfMachine,
  roomsOf, staffRested, step,
} from '../src';
import type { Command, LineTile, Tile, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function ticks(world: World, count: number): World {
  let current = world;
  for (let tick = 0; tick < count; tick++) current = step(current);
  return current;
}

/** Tiles of the outline of a rectangle, as one continuous path. */
function outline(x: number, y: number, width: number, height: number): LineTile[] {
  const path: Tile[] = [];
  for (let column = x; column < x + width; column++) path.push({ x: column, y });
  for (let row = y + 1; row < y + height; row++) path.push({ x: x + width - 1, y: row });
  for (let column = x + width - 2; column >= x; column--) path.push({ x: column, y: y + height - 1 });
  for (let row = y + height - 2; row > y; row--) path.push({ x, y: row });
  return path.map(tile => ({ ...tile, rotation: 0 }));
}

/** Sandbox world with a 6 × 5 walled room (inside 4 × 3, tiles x 11-14, y 11-13) and a door. */
function walledRoom(): World {
  let world = run(createWorld(), { kind: 'build-line', type: 'wall', tiles: outline(10, 10, 6, 5) });
  world = run(world, { kind: 'demolish', id: 3 });
  return run(world, { kind: 'build', type: 'door', x: 12, y: 10, rotation: 0 });
}

describe('pièces', () => {
  it('reconnaît une zone fermée par des murs et une porte, pas une zone ouverte ni le bord de carte', () => {
    const open = run(createWorld(), { kind: 'build-line', type: 'wall', tiles: outline(10, 10, 6, 5).slice(0, 15) });
    expect(roomsOf(open).rooms).toEqual([]);
    const world = walledRoom();
    const { rooms } = roomsOf(world);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]).toMatchObject({ id: 11 * 128 + 11, type: 'empty', sofas: 0 });
    expect(rooms[0]?.tiles).toHaveLength(12);
    expect(world.capitalCents).toBe(createWorld().capitalCents - 18 * MACHINES.wall.costCents + MACHINES.wall.costCents / 2 - MACHINES.door.costCents);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('fait une salle de repos avec canapé et café, qui protège le moral', () => {
    let world = walledRoom();
    world = run(world, { kind: 'build', type: 'sofa', x: 11, y: 11, rotation: 0 });
    expect(roomsOf(world).rooms[0]?.type).toBe('empty');
    world = run(world, { kind: 'build', type: 'coffee', x: 14, y: 13, rotation: 0 });
    expect(roomsOf(world).rooms[0]?.type).toBe('break-room');
    expect(breakRoomSeats(world)).toBe(ROOMS.seatsPerSofa);
    const [candidate] = world.staff.candidates;
    if (!candidate) throw new Error('vivier vide');
    world = run(world, { kind: 'hire', candidate: candidate.id });
    expect(staffRested(world)).toBe(true);
    const paid = ticks(world, STAFF.payPeriodTicks);
    expect(paid.staff.employees[0]?.morale).toBe(STAFF.morale.initial + ROOMS.restedMorale.paid);
    const unpaid = ticks({ ...world, capitalCents: 0 }, STAFF.payPeriodTicks);
    expect(unpaid.staff.employees[0]?.morale).toBe(STAFF.morale.initial - ROOMS.restedMorale.unpaid);
  });

  it('remonte le moral d’un point par plante de bureau ou de salle de repos, dans la limite', () => {
    let world = walledRoom();
    world = run(world, { kind: 'build', type: 'plant', x: 11, y: 11, rotation: 0 });
    expect(roomsOf(world).rooms[0]).toMatchObject({ type: 'empty', plants: 1 });
    expect(plantMorale(world)).toBe(0);
    world = run(world, { kind: 'build', type: 'desk', x: 12, y: 13, rotation: 0 });
    expect(plantMorale(world)).toBe(ROOMS.plantMorale);
    for (const x of [12, 13, 14]) world = run(world, { kind: 'build', type: 'plant', x, y: 11, rotation: 0 });
    world = run(world, { kind: 'build', type: 'plant', x: 11, y: 12, rotation: 0 });
    expect(roomsOf(world).rooms[0]?.plants).toBe(5);
    expect(plantMorale(world)).toBe(ROOMS.maxPlantMorale);
    const [candidate] = world.staff.candidates;
    if (!candidate) throw new Error('vivier vide');
    world = run(world, { kind: 'hire', candidate: candidate.id });
    const paid = ticks(world, STAFF.payPeriodTicks);
    expect(paid.staff.employees[0]?.morale).toBe(Math.min(100, STAFF.morale.initial + STAFF.morale.paid + ROOMS.maxPlantMorale));
    expect(checkIntegrity(paid)).toBe(true);
  });

  it('agrandit le vivier d’un candidat par bureau, dans la limite', () => {
    let world = walledRoom();
    expect(poolSizeOf(world)).toBe(STAFF.poolSize);
    world = run(world, { kind: 'build', type: 'desk', x: 11, y: 11, rotation: 0 });
    expect(roomsOf(world).rooms[0]?.type).toBe('office');
    expect(poolSizeOf(world)).toBe(STAFF.poolSize + 1);
    const later = ticks(world, STAFF.poolRefreshTicks);
    expect(later.staff.candidates).toEqual(candidatesFor(1, STAFF.poolSize + 1));
    expect(candidatesFor(1, STAFF.poolSize + 1).slice(0, STAFF.poolSize)).toEqual(candidatesFor(1));
    expect(checkIntegrity(later)).toBe(true);
  });

  it('fait une salle blanche avec un filtre et un sol propre partout, qui divise les rebuts', () => {
    let world = walledRoom();
    world = run(world, { kind: 'build', type: 'air-filter', x: 14, y: 11, rotation: 0 });
    world = run(world, { kind: 'build', type: 'tester', x: 11, y: 12, rotation: 1 });
    expect(roomsOf(world).rooms[0]?.type).toBe('empty');
    const inside: Tile[] = [];
    for (let y = 11; y <= 13; y++) for (let x = 11; x <= 14; x++) inside.push({ x, y });
    const before = world.capitalCents;
    world = run(world, { kind: 'paint-floor', tiles: inside, floor: 'clean' });
    expect(world.capitalCents).toBe(before - 12 * FLOOR_COST_CENTS.clean);
    expect(roomsOf(world).rooms[0]?.type).toBe('clean-room');
    const tester = world.machines.find(machine => machine.type === 'tester');
    if (!tester) throw new Error('banc absent');
    expect(inCleanRoom(world, tester)).toBe(true);
    expect(rejectionFor(world, tester, PROFESSIONAL_RECIPES.tester)).toBe(8 * ROOMS.cleanRejectionFactor);
    expect(roomOfMachine(world, tester)?.clean).toBe(true);
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, { kind: 'paint-floor', tiles: inside, floor: 'clean' })).toMatchObject({ ok: true, world });
    const bare = run(world, { kind: 'paint-floor', tiles: [{ x: 11, y: 11 }], floor: 'concrete' });
    expect(roomsOf(bare).rooms[0]?.type).toBe('empty');
    expect(bare.capitalCents).toBe(world.capitalCents);
  });

  it('refuse un sol hors carte, verrouillé ou trop cher, et un sol enregistré invalide', () => {
    const world = createWorld();
    expect(applyCommand(world, { kind: 'paint-floor', tiles: [{ x: 128, y: 0 }], floor: 'wood' })).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(applyCommand(world, { kind: 'paint-floor', tiles: [{ x: 64, y: 0 }], floor: 'wood' })).toEqual({ ok: false, reason: 'not-owned' });
    expect(applyCommand(createWorld('progression'), { kind: 'paint-floor', tiles: [{ x: 1, y: 1 }], floor: 'wood' }))
      .toEqual({ ok: false, reason: 'locked' });
    expect(applyCommand({ ...world, capitalCents: 0 }, { kind: 'paint-floor', tiles: [{ x: 1, y: 1 }], floor: 'wood' }))
      .toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(checkIntegrity({ ...world, floors: { 16384: 'wood' } })).toBe(false);
    expect(checkIntegrity({ ...world, floors: { 100: 'wood' } })).toBe(false);
    expect(checkIntegrity({ ...world, floors: { 12: 'wood' } })).toBe(true);
  });
});
