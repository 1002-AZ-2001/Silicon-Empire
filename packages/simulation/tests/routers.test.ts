import { MACHINES } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, beltStatus, checkIntegrity, contentsOf, createWorld, inventoryTotal, lineCost, routerLinks, step,
} from '../src';
import type { ItemType } from '@silicon-empire/game-data';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function ticks(world: World, count: number): World {
  let current = world;
  for (let tick = 0; tick < count; tick++) {
    current = step(current);
    if (!checkIntegrity(current)) throw new Error(`Monde incohérent au tick ${current.tick}`);
  }
  return current;
}

const order = (id: number, item: ItemType): Command => ({ kind: 'order', id, item });

/**
 * Dock (1) facing north, conveyor (2), splitter (3) facing north,
 * storages on its left (4), front (5) and right (6), each with its input facing the splitter.
 */
const splitterLine: Command[] = [
  { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
  { kind: 'build', type: 'splitter', x: 11, y: 8, rotation: 0 },
  { kind: 'build', type: 'storage', x: 10, y: 8, rotation: 3 },
  { kind: 'build', type: 'storage', x: 11, y: 7, rotation: 0 },
  { kind: 'build', type: 'storage', x: 12, y: 8, rotation: 1 },
];

describe('répartiteur', () => {
  it('raccorde l’arrière en entrée et la gauche, l’avant, la droite en sortie', () => {
    const world = splitterLine.reduce(run, createWorld());
    expect(routerLinks(world, 3)).toEqual({
      id: 3,
      type: 'splitter',
      inputs: [2],
      outputs: [{ kind: 'stock', id: 4 }, { kind: 'stock', id: 5 }, { kind: 'stock', id: 6 }],
    });
  });

  it('distribue à tour de rôle à gauche, devant puis à droite en conservant chaque unité', () => {
    const end = ticks(run(splitterLine.reduce(run, createWorld()), order(1, 'cpu-8c')), 400);
    expect(end.stocks[4]).toEqual({ 'cpu-8c': 4 });
    expect(end.stocks[5]).toEqual({ 'cpu-8c': 3 });
    expect(end.stocks[6]).toEqual({ 'cpu-8c': 3 });
    expect(end.belts).toEqual({});
    expect(end.routers[3]).toEqual({ held: null, cursor: 1 });
  });

  it('envoie le composant filtré sur sa sortie et répartit les autres sur les sorties restantes', () => {
    let world = run(splitterLine.reduce(run, createWorld()), {
      kind: 'configure', id: 3, filter: { item: 'gpu-8g', output: 'right' },
    });
    world = run(run(world, order(1, 'cpu-8c')), order(1, 'gpu-8g'));
    const end = ticks(world, 800);
    expect(end.stocks[6]).toEqual({ 'gpu-8g': 10 });
    expect(end.stocks[4]).toEqual({ 'cpu-8c': 5 });
    expect(end.stocks[5]).toEqual({ 'cpu-8c': 5 });
  });

  it('retient une unité filtrée tant que sa sortie est bloquée', () => {
    let world = splitterLine.slice(0, 5).reduce(run, createWorld());
    world = run(world, { kind: 'configure', id: 3, filter: { item: 'ram-16g', output: 'right' } });
    world = run(run(world, order(1, 'cpu-8c')), order(1, 'ram-16g'));
    const end = ticks(world, 800);
    // The dock alternates CPU and RAM: the first RAM unit waits in the splitter and holds back the rest.
    expect(inventoryTotal(end.stocks[4] ?? {}) + inventoryTotal(end.stocks[5] ?? {})).toBe(1);
    expect(end.routers[3]?.held?.item).toBe('ram-16g');
    expect(beltStatus(end, 2)).toBe('blocked');
    expect(step(end).routers).toBe(end.routers);
  });

  it('refuse un filtre hors répartiteur et retire le filtre sur demande', () => {
    const world = splitterLine.reduce(run, createWorld());
    expect(applyCommand(world, { kind: 'configure', id: 2, filter: null })).toEqual({ ok: false, reason: 'not-a-splitter' });
    const filtered = run(world, { kind: 'configure', id: 3, filter: { item: 'cpu-8c', output: 'front' } });
    expect(filtered.machines[2]?.filter).toEqual({ item: 'cpu-8c', output: 'front' });
    expect(checkIntegrity(filtered)).toBe(true);
    const cleared = run(filtered, { kind: 'configure', id: 3, filter: null });
    expect(cleared.machines[2]).not.toHaveProperty('filter');
  });

  it('met au rebut l’unité tenue par un répartiteur démoli', () => {
    let world = splitterLine.slice(0, 3).reduce(run, createWorld());
    world = ticks(run(world, order(1, 'ssd-1t')), 60);
    expect(world.routers[3]?.held?.item).toBe('ssd-1t');
    expect(contentsOf(world, 3)).toEqual({ 'ssd-1t': 1 });
    const demolished = run(world, { kind: 'demolish', id: 3 });
    expect(demolished.routers[3]).toBeUndefined();
    expect(demolished.ledger.discarded).toEqual({ 'ssd-1t': 1 });
    expect(checkIntegrity(demolished)).toBe(true);
  });
});

/**
 * Merger (1) facing north at 20,20 with a storage (2) in front.
 * Dock A (3) feeds it from the left through conveyors 4 and 5, dock B (6) from the right through 7 and 8.
 */
const mergerLine: Command[] = [
  { kind: 'build', type: 'merger', x: 20, y: 20, rotation: 0 },
  { kind: 'build', type: 'storage', x: 20, y: 19, rotation: 0 },
  { kind: 'build', type: 'receiving', x: 17, y: 21, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 18, y: 20, rotation: 1 },
  { kind: 'build', type: 'conveyor', x: 19, y: 20, rotation: 1 },
  { kind: 'build', type: 'receiving', x: 21, y: 21, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 22, y: 20, rotation: 3 },
  { kind: 'build', type: 'conveyor', x: 21, y: 20, rotation: 3 },
];

describe('fusionneur', () => {
  it('prend à tour de rôle les unités en attente sur ses entrées', () => {
    let world = mergerLine.reduce(run, createWorld());
    expect(routerLinks(world, 1)?.inputs).toEqual([5, null, 8]);
    world = run(run(world, order(3, 'cpu-8c')), order(6, 'ram-16g'));
    for (let tick = 0; tick < 2000 && inventoryTotal(world.stocks[2] ?? {}) < 10; tick++) world = ticks(world, 1);
    const stock = world.stocks[2] ?? {};
    expect(inventoryTotal(stock)).toBe(10);
    expect(Math.abs((stock['cpu-8c'] ?? 0) - (stock['ram-16g'] ?? 0))).toBeLessThanOrEqual(1);
    const end = ticks(world, 600);
    expect(end.stocks[2]).toEqual({ 'cpu-8c': 10, 'ram-16g': 10 });
  });

  it('produit le même état après sérialisation en milieu de fusion', () => {
    const middle = ticks(run(run(mergerLine.reduce(run, createWorld()), order(3, 'cpu-8c')), order(6, 'gpu-8g')), 97);
    const restored: World = JSON.parse(JSON.stringify(middle));
    expect(ticks(restored, 300)).toEqual(ticks(middle, 300));
  });
});

describe('pose d’une ligne de convoyeurs', () => {
  const line: Command = {
    kind: 'build-line',
    tiles: [
      { x: 5, y: 5, rotation: 1 },
      { x: 6, y: 5, rotation: 1 },
      { x: 7, y: 5, rotation: 2 },
      { x: 7, y: 6, rotation: 2 },
    ],
  };

  it('construit toute la ligne en une commande et facture chaque tuile', () => {
    const world = run(createWorld(), line);
    expect(world.machines.map(({ x, y, rotation, id }) => ({ x, y, rotation, id }))).toEqual([
      { x: 5, y: 5, rotation: 1, id: 1 },
      { x: 6, y: 5, rotation: 1, id: 2 },
      { x: 7, y: 5, rotation: 2, id: 3 },
      { x: 7, y: 6, rotation: 2, id: 4 },
    ]);
    expect(world.capitalCents).toBe(createWorld().capitalCents - lineCost(4));
    expect(world.nextMachineId).toBe(5);
  });

  it.each([
    [{ kind: 'build-line', tiles: [] }, 'invalid-line'],
    [{ kind: 'build-line', tiles: [{ x: 5, y: 5, rotation: 1 }, { x: 7, y: 5, rotation: 1 }] }, 'invalid-line'],
    [{ kind: 'build-line', tiles: [{ x: 5, y: 5, rotation: 1 }, { x: 6, y: 5, rotation: 3 }, { x: 5, y: 5, rotation: 1 }] }, 'invalid-line'],
    [{ kind: 'build-line', tiles: [{ x: 63, y: 5, rotation: 1 }, { x: 64, y: 5, rotation: 1 }] }, 'not-owned'],
    [{ kind: 'build-line', tiles: [{ x: 5, y: 0, rotation: 0 }, { x: 5, y: -1, rotation: 0 }] }, 'out-of-bounds'],
  ] satisfies [Command, string][])('refuse une ligne invalide sans rien construire %#', (command, reason) => {
    expect(applyCommand(createWorld(), command)).toEqual({ ok: false, reason });
  });

  it('refuse toute la ligne si une tuile est occupée ou si le capital manque', () => {
    const occupied = run(createWorld(), { kind: 'build', type: 'storage', x: 7, y: 6, rotation: 0 });
    expect(applyCommand(occupied, line)).toEqual({ ok: false, reason: 'occupied' });
    const poor = { ...createWorld(), capitalCents: lineCost(4) - 1 };
    expect(applyCommand(poor, line)).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(run({ ...createWorld(), capitalCents: lineCost(4) }, line).capitalCents).toBe(0);
    expect(MACHINES.conveyor.costCents).toBeGreaterThan(0);
  });
});
