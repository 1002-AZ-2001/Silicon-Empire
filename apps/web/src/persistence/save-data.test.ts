import { WORKSHOP } from '@silicon-empire/game-data';
import { applyCommand, createWorld, step } from '@silicon-empire/simulation';
import { describe, expect, it } from 'vitest';
import { SAVE_VERSION, decodeSave } from './save-data';
import type { Command, World } from '@silicon-empire/simulation';
import type { SaveRecord } from './save-data';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

const result = applyCommand(createWorld(), { kind: 'build', type: 'tester', x: 12, y: 15, rotation: 1 });
if (!result.ok || !result.machine) throw new Error('Le scénario de test doit pouvoir construire une machine.');
const built = { world: result.world, machine: result.machine };

const record: SaveRecord = {
  id: '00000000000000000000000000000001',
  name: 'Atelier des pins',
  version: SAVE_VERSION,
  createdAt: 1000,
  savedAt: 2000,
  world: built.world,
};

/** Dock, two conveyors and a storage, with a lot in transit. */
let transit = ([
  { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 8, rotation: 0 },
  { kind: 'build', type: 'storage', x: 11, y: 7, rotation: 0 },
  { kind: 'order', id: 1, item: 'cpu-8c' },
] satisfies Command[]).reduce(run, createWorld());
for (let tick = 0; tick < 45; tick++) transit = step(transit);
const inTransit: SaveRecord = { ...record, world: transit };

describe('schéma de sauvegarde', () => {
  it('restaure le capital, l’orientation et le prix réellement payé', () => {
    expect(decodeSave(JSON.parse(JSON.stringify(record)))).toEqual(record);
    const historicalPrice = {
      ...record,
      world: { ...record.world, machines: [{ ...built.machine, paidCents: built.machine.paidCents - 200 }] },
    };
    expect(decodeSave(historicalPrice)).toEqual(historicalPrice);
  });

  it('restaure les stocks et les unités en transit', () => {
    expect(Object.keys(transit.belts).length).toBeGreaterThan(0);
    expect(transit.stocks[4]).toBeDefined();
    expect(decodeSave(JSON.parse(JSON.stringify(inTransit)))).toEqual(inTransit);
  });

  it('migre une sauvegarde v0.1 sans perdre les constructions', () => {
    const { columns, rows, capitalCents, nextMachineId, machines } = built.world;
    const v1 = { ...record, version: 1, world: { columns, rows, capitalCents, nextMachineId, machines } };
    expect(decodeSave(v1)).toEqual(record);
    expect(decodeSave({ ...v1, world: { ...v1.world, tick: 0 } })).toBeNull();
  });

  it('migre une sauvegarde v0.2.0 avec ses unités en transit', () => {
    const v2 = JSON.parse(JSON.stringify({ ...inTransit, version: 2 }));
    for (const key of ['routers', 'production', 'progress']) delete v2.world[key];
    for (const key of ['produced', 'consumed', 'delivered']) delete v2.world.ledger[key];
    expect(decodeSave(v2)).toEqual(inTransit);
    expect(decodeSave({ ...v2, world: { ...v2.world, routers: {} } })).toBeNull();
  });

  it('migre une sauvegarde v0.2.x en bac à sable et refuse ses champs v4', () => {
    const v3 = JSON.parse(JSON.stringify({ ...inTransit, version: 3 }));
    for (const key of ['production', 'progress']) delete v3.world[key];
    for (const key of ['produced', 'consumed', 'delivered']) delete v3.world.ledger[key];
    const migrated = decodeSave(v3);
    expect(migrated?.world.progress).toEqual({ sandbox: true, completed: [], active: null, delivered: {} });
    expect(migrated).toEqual(inTransit);
    expect(decodeSave({ ...v3, world: { ...v3.world, production: {} } })).toBeNull();
  });

  it('restaure une partie en progression avec un jalon en cours et un lot en fabrication', () => {
    let world = ([
      { kind: 'build', type: 'headquarters', x: 20, y: 20, rotation: 0 },
      { kind: 'build', type: 'receiving', x: 18, y: 25, rotation: 0 },
      { kind: 'build-line', tiles: [
        { x: 19, y: 24, rotation: 0 }, { x: 19, y: 23, rotation: 1 }, { x: 20, y: 23, rotation: 0 }, { x: 20, y: 22, rotation: 0 },
      ] },
      { kind: 'select-milestone', milestone: 'assembly-bench' },
      { kind: 'order', id: 2, item: 'case-standard' },
    ] satisfies Command[]).reduce(run, createWorld('progression'));
    for (let tick = 0; tick < 150; tick++) world = step(world);
    expect(Object.keys(world.progress.delivered)).toEqual(['assembly-bench']);
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, completed: ['quality-control'] } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, progress: { ...world.progress, sandbox: true } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, ledger: { ...world.ledger, delivered: {} } } })).toBeNull();
    expect(decodeSave({
      ...saved,
      world: { ...world, machines: [...world.machines, { id: 99, type: 'assembler', x: 1, y: 1, rotation: 0, paidCents: 1 }], nextMachineId: 100 },
    })).toBeNull();
  });

  it('restaure un répartiteur filtré qui tient une unité', () => {
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
      { kind: 'build', type: 'splitter', x: 11, y: 8, rotation: 0 },
      { kind: 'configure', id: 3, filter: { item: 'cpu-8c', output: 'left' } },
      { kind: 'order', id: 1, item: 'cpu-8c' },
    ] satisfies Command[]).reduce(run, createWorld());
    for (let tick = 0; tick < 60; tick++) world = step(world);
    expect(world.routers[3]?.held).not.toBeNull();
    const saved: SaveRecord = { ...record, world };
    expect(decodeSave(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
    expect(decodeSave({ ...saved, world: { ...world, routers: { 3: { held: null, cursor: 0 } } } })).toBeNull();
    expect(decodeSave({ ...saved, world: { ...world, routers: { 2: world.routers[3] } } })).toBeNull();
    expect(decodeSave({
      ...saved,
      world: { ...world, machines: world.machines.map(machine => ({ ...machine, filter: { item: 'cpu-8c', output: 'left' } })) },
    })).toBeNull();
  });

  it.each([
    null,
    { ...record, version: 5 },
    { ...record, name: '' },
    { ...record, savedAt: 500 },
    { ...record, world: { ...record.world, columns: 32 } },
    { ...record, world: { ...record.world, capitalCents: -1 } },
    { ...record, world: { ...record.world, capitalCents: WORKSHOP.initialCapitalCents } },
    { ...record, world: { ...record.world, nextMachineId: 1 } },
  ])('rejette les versions et états invalides %#', data => {
    expect(decodeSave(data)).toBeNull();
  });

  it.each([
    { ...built.machine, id: 2, y: 16 },
    { ...built.machine, x: 20 },
    { ...built.machine, id: 2, y: 63 },
    { ...built.machine, id: 2, x: 20, rotation: 4 },
    { ...built.machine, id: 2, x: 20, type: 'unknown' },
  ])('rejette les machines incohérentes %#', machine => {
    expect(decodeSave({
      ...record,
      world: {
        ...record.world,
        capitalCents: 0,
        nextMachineId: 3,
        machines: [built.machine, machine],
      },
    })).toBeNull();
  });

  it.each<(world: World) => unknown>([
    world => ({ ...world, stocks: { ...world.stocks, 2: { 'cpu-8c': 1 } } }),
    world => ({ ...world, stocks: { ...world.stocks, 4: { 'cpu-8c': 41 } } }),
    world => ({ ...world, stocks: { ...world.stocks, 4: { 'cpu-8c': 0 } } }),
    world => ({ ...world, belts: { ...world.belts, 4: [{ id: 1, item: 'cpu-8c', position: 0 }] } }),
    world => ({ ...world, belts: { ...world.belts, 2: [{ id: 99, item: 'cpu-8c', position: 20 }] } }),
    world => ({ ...world, belts: { ...world.belts, 2: [{ id: 99, item: 'cpu-8c', position: 3 }] } }),
    world => ({ ...world, belts: { ...world.belts, 3: [] } }),
    world => ({ ...world, ledger: { ...world.ledger, purchased: { 'cpu-8c': 11 } } }),
    world => ({ ...world, ledger: { ...world.ledger, purchaseSpentCents: world.ledger.purchaseSpentCents + world.capitalCents + 1 } }),
  ])('rejette les inventaires et convoyeurs incohérents %#', change => {
    expect(decodeSave({ ...inTransit, world: change(transit) })).toBeNull();
  });
});
