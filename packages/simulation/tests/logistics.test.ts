import { CONVEYOR, ITEMS, MACHINES, PURCHASE, TIME } from '@silicon-empire/game-data';
import type { ItemType } from '@silicon-empire/game-data';
import { describe, expect, it, vi } from 'vitest';
import {
  FixedStepClock, Simulation, applyCommand, beltStatus, checkIntegrity, contentsOf, createWorld,
  inventoryTotal, portConnections, portsOf, sameContents, step,
} from '../src';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function ticks(world: World, count: number, check = false): World {
  let current = world;
  for (let tick = 0; tick < count; tick++) {
    current = step(current);
    if (check && !checkIntegrity(current)) throw new Error(`Monde incohérent au tick ${current.tick}`);
  }
  return current;
}

/** Dock (id 1) at 10,10 facing north, two conveyors (ids 2, 3) going north, storage (id 4) above. */
const line: Command[] = [
  { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 8, rotation: 0 },
  { kind: 'build', type: 'storage', x: 11, y: 7, rotation: 0 },
];
const order = (item: ItemType = 'cpu-8c'): Command => ({ kind: 'order', id: 1, item });

describe('ports', () => {
  it('pivote les ports avec l’emprise de la machine', () => {
    const dock = { type: 'receiving', x: 10, y: 10 } as const;
    expect(portsOf({ ...dock, rotation: 0 })).toEqual([{ kind: 'output', tile: { x: 11, y: 10 }, side: 0 }]);
    expect(portsOf({ ...dock, rotation: 1 })).toEqual([{ kind: 'output', tile: { x: 11, y: 11 }, side: 1 }]);
    expect(portsOf({ ...dock, rotation: 2 })).toEqual([{ kind: 'output', tile: { x: 11, y: 11 }, side: 2 }]);
    expect(portsOf({ ...dock, rotation: 3 })).toEqual([{ kind: 'output', tile: { x: 10, y: 11 }, side: 3 }]);
    expect(portsOf({ type: 'storage', x: 4, y: 4, rotation: 1 })).toEqual([
      { kind: 'input', tile: { x: 4, y: 4 }, side: 3 },
      { kind: 'output', tile: { x: 4, y: 4 }, side: 1 },
    ]);
  });

  it('signale les ports raccordés dans le bon sens', () => {
    const world = line.reduce(run, createWorld());
    const [dock, , , storage] = world.machines;
    if (!dock || !storage) throw new Error('Ligne incomplète');
    expect(portConnections(world, dock).map(port => port.connected)).toEqual([true]);
    expect(portConnections(world, storage).map(port => port.connected)).toEqual([true, false]);
    const reversed = run(run(world, { kind: 'rotate', id: 2 }), { kind: 'rotate', id: 2 });
    expect(portConnections(reversed, dock).map(port => port.connected)).toEqual([false]);
  });
});

describe('achats au quai', () => {
  it('débite le lot, remplit le quai et inscrit l’achat', () => {
    const world = run(line.reduce(run, createWorld()), order());
    const cost = ITEMS['cpu-8c'].unitCostCents * PURCHASE.lotSize;
    expect(world.capitalCents).toBe(line.reduce(run, createWorld()).capitalCents - cost);
    expect(world.stocks[1]).toEqual({ 'cpu-8c': PURCHASE.lotSize });
    expect(world.ledger).toEqual({ purchased: { 'cpu-8c': 10 }, discarded: {}, purchaseSpentCents: cost });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('refuse une commande hors quai, sans fonds ou au-delà de la capacité', () => {
    const world = line.reduce(run, createWorld());
    expect(applyCommand(world, { kind: 'order', id: 4, item: 'cpu-8c' })).toEqual({ ok: false, reason: 'not-a-dock' });
    expect(applyCommand(world, { kind: 'order', id: 99, item: 'cpu-8c' })).toEqual({ ok: false, reason: 'missing-machine' });
    expect(applyCommand({ ...world, capitalCents: 179_999 }, order())).toEqual({ ok: false, reason: 'insufficient-funds' });
    const lots = MACHINES.receiving.capacity / PURCHASE.lotSize;
    const full = Array.from({ length: lots }, () => order('ram-16g')).reduce(run, world);
    expect(inventoryTotal(full.stocks[1] ?? {})).toBe(MACHINES.receiving.capacity);
    expect(applyCommand(full, order('ram-16g'))).toEqual({ ok: false, reason: 'dock-full' });
  });
});

describe('convoyeurs', () => {
  it('achemine un lot du quai au casier en conservant chaque unité', () => {
    const start = run(line.reduce(run, createWorld()), order());
    const capital = start.capitalCents;
    const end = ticks(start, 200, true);
    expect(end.stocks[4]).toEqual({ 'cpu-8c': 10 });
    expect(end.stocks[1]).toBeUndefined();
    expect(end.belts).toEqual({});
    expect(end.capitalCents).toBe(capital);
    expect(end.nextItemId).toBe(11);
    expect(end.tick).toBe(200);
  });

  it('avance d’une unité de bande par tick et respecte l’espacement', () => {
    const start = run(line.reduce(run, createWorld()), order());
    const first = step(start);
    expect(first.belts[2]).toEqual([{ id: 1, item: 'cpu-8c', position: 0 }]);
    const later = ticks(first, CONVEYOR.spacingUnits);
    expect(later.belts[2]).toEqual([
      { id: 1, item: 'cpu-8c', position: CONVEYOR.spacingUnits },
      { id: 2, item: 'cpu-8c', position: 0 },
    ]);
    expect(beltStatus(later, 2)).toBe('moving');
  });

  it('sature la ligne lorsque le casier est plein et bloque en amont sans perte', () => {
    let world = line.reduce(run, createWorld());
    for (let lot = 0; lot < 5; lot++) world = run(world, order(lot % 2 ? 'ram-16g' : 'ssd-1t'));
    world = ticks(world, 600, true);
    expect(inventoryTotal(world.stocks[4] ?? {})).toBe(MACHINES.storage.capacity);
    expect(world.belts[3]).toHaveLength(2);
    expect(world.belts[2]).toHaveLength(2);
    expect(inventoryTotal(world.stocks[1] ?? {})).toBe(50 - 40 - 4);
    expect(beltStatus(world, 3)).toBe('blocked');
    expect(step(world).belts).toBe(world.belts);
    expect(step(world).stocks).toBe(world.stocks);
  });

  it('libère le casier vers un convoyeur de sortie raccordé', () => {
    const world = ([...line,
      { kind: 'build', type: 'conveyor', x: 11, y: 6, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 11, y: 5, rotation: 1 },
    ] satisfies Command[]).reduce(run, createWorld());
    const end = ticks(run(world, order()), 300, true);
    expect(end.stocks[4]).toEqual({ 'cpu-8c': 6 });
    expect(end.belts[6]).toHaveLength(2);
    expect(beltStatus(end, 6)).toBe('blocked');
    expect(end.belts[5]).toHaveLength(2);
  });

  it('n’envoie rien vers un convoyeur tourné vers la machine', () => {
    const world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 2 },
    ] satisfies Command[]).reduce(run, createWorld());
    const end = ticks(run(world, order()), 50);
    expect(end.stocks[1]).toEqual({ 'cpu-8c': 10 });
    expect(end.belts).toEqual({});
  });

  it('met au rebut explicitement les unités d’un équipement démoli', () => {
    const moving = ticks(run(line.reduce(run, createWorld()), order()), 25);
    const onBelt = contentsOf(moving, 2);
    expect(inventoryTotal(onBelt)).toBeGreaterThan(0);
    const demolished = run(moving, { kind: 'demolish', id: 2 });
    expect(demolished.belts[2]).toBeUndefined();
    expect(demolished.ledger.discarded).toEqual(onBelt);
    expect(demolished.capitalCents).toBe(moving.capitalCents + MACHINES.conveyor.costCents / 2);
    expect(checkIntegrity(demolished)).toBe(true);
    expect(checkIntegrity({ ...demolished, ledger: { ...demolished.ledger, discarded: {} } })).toBe(false);
  });
});

describe('déterminisme et horloge', () => {
  it('produit le même état pour les mêmes commandes et ticks, quel que soit le découpage', () => {
    const start = run(run(line.reduce(run, createWorld()), order()), order('gpu-8g'));
    const single = new Simulation(start);
    for (let tick = 0; tick < 150; tick++) single.advance(1);
    const batched = new Simulation(start);
    batched.advance(70);
    batched.advance(80);
    expect(batched.getSnapshot()).toEqual(single.getSnapshot());
    expect(JSON.parse(JSON.stringify(single.getSnapshot()))).toEqual(single.getSnapshot());
  });

  it('reprend à l’identique après sérialisation en milieu de transfert', () => {
    const middle = ticks(run(line.reduce(run, createWorld()), order()), 33);
    expect(Object.keys(middle.belts).length).toBeGreaterThan(0);
    const restored: World = JSON.parse(JSON.stringify(middle));
    expect(ticks(restored, 120)).toEqual(ticks(middle, 120));
  });

  it('convertit le temps réel en ticks selon la vitesse et limite le rattrapage', () => {
    const clock = new FixedStepClock();
    const tickMs = 1000 / TIME.ticksPerSecond;
    expect(clock.advance(tickMs * 2.5)).toBe(2);
    expect(clock.progress).toBeCloseTo(0.5);
    clock.speed = 5;
    expect(clock.advance(tickMs)).toBe(5);
    clock.speed = 0;
    expect(clock.advance(10_000)).toBe(0);
    clock.speed = 2;
    expect(clock.advance(60_000)).toBe(TIME.maxTicksPerFrame);
    expect(clock.advance(0)).toBe(0);
  });

  it('publie les ticks séparément des commandes et garde l’état précédent pour l’interpolation', () => {
    const simulation = new Simulation(run(line.reduce(run, createWorld()), order()));
    const listener = vi.fn();
    simulation.subscribe(listener);
    simulation.advance(3);
    expect(listener).toHaveBeenLastCalledWith('tick');
    expect(simulation.getPrevious().tick).toBe(2);
    expect(simulation.getSnapshot().tick).toBe(3);
    simulation.advance(0);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('distingue le contenu du simple passage du temps', () => {
    const empty = createWorld();
    expect(sameContents(empty, step(empty))).toBe(true);
    const supplied = run(line.reduce(run, createWorld()), order());
    expect(sameContents(supplied, step(supplied))).toBe(false);
  });
});
