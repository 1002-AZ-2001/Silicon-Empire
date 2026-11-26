import { RECIPES, saleOffer } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import { applyCommand, canReceive, checkIntegrity, createWorld, salesAccounts, step } from '../src';
import type { ItemType } from '@silicon-empire/game-data';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

const dock = { kind: 'build', type: 'shipping', x: 14, y: 9, rotation: 0 } as const;
const start = { kind: 'start-sale', model: 'office' } as const;

describe('ventes', () => {
  it('limite les commandes au quai et réserve la réception au produit demandé', () => {
    const world = createWorld();
    expect(applyCommand(world, start)).toEqual({ ok: false, reason: 'no-shipping-dock' });
    const withDock = run(world, dock);
    expect(canReceive(withDock, 1, 'pc-office-packaged')).toBe(false);
    const ordered = run(withDock, start);
    expect(canReceive(ordered, 1, 'pc-office-packaged')).toBe(true);
    expect(canReceive(ordered, 1, 'pc-office-tested')).toBe(false);
    expect(canReceive(ordered, 1, 'pc-gaming-packaged')).toBe(false);
    expect(applyCommand(ordered, start)).toEqual({ ok: false, reason: 'sale-in-progress' });
    expect(run(ordered, { kind: 'cancel-sale' }).sales.active).toBeNull();
  });

  it('achète, fabrique puis vend dix PC avec un paiement unique après reprise', () => {
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 20, rotation: 0 },
      { kind: 'build-line', tiles: [{ x: 11, y: 19, rotation: 0 }, { x: 11, y: 18, rotation: 0 }] },
      { kind: 'build', type: 'assembler', x: 11, y: 16, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 12, y: 15, rotation: 0 },
      { kind: 'build', type: 'tester', x: 12, y: 14, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 13, y: 13, rotation: 0 },
      { kind: 'build', type: 'packager', x: 13, y: 12, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 14, y: 11, rotation: 0 },
      dock,
      { kind: 'build', type: 'receiving', x: 13, y: 15, rotation: 0 },
      { kind: 'build-line', tiles: [{ x: 14, y: 14, rotation: 0 }, { x: 14, y: 13, rotation: 0 }] },
      { kind: 'order', id: 11, item: 'carton' },
      start,
    ] satisfies Command[]).reduce(run, createWorld());
    for (const item of Object.keys(RECIPES.assembler.inputs) as ItemType[]) {
      world = run(world, { kind: 'order', id: 1, item });
    }
    const capital = world.capitalCents;
    for (let tick = 0; tick < 7000 && (world.sales.active?.delivered ?? 0) < 5; tick++) world = step(world);
    expect(world.sales.active?.delivered).toBe(5);
    expect(world.capitalCents).toBe(capital);
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, { kind: 'cancel-sale' })).toEqual({ ok: false, reason: 'sale-already-shipped' });
    world = JSON.parse(JSON.stringify(world)) as World;
    for (let tick = 0; tick < 7000; tick++) world = step(world);
    expect(world.sales.active).toBeNull();
    expect(world.sales.completed).toEqual([saleOffer('office')]);
    expect(world.capitalCents).toBe(capital + 650_000);
    expect(salesAccounts(world.sales)).toEqual({
      revenueCents: 650_000, materialCents: 473_000, shipped: { 'pc-office-packaged': 10 },
    });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('laisse le surplus sur l’autre convoyeur lorsque deux quais reçoivent au même tick', () => {
    const layout = ([
      dock,
      { kind: 'build', type: 'conveyor', x: 14, y: 11, rotation: 0 },
      { ...dock, x: 18 },
      { kind: 'build', type: 'conveyor', x: 18, y: 11, rotation: 0 },
    ] satisfies Command[]).reduce(run, createWorld());
    const world: World = {
      ...layout,
      nextItemId: 3,
      sales: { active: { terms: saleOffer('office'), delivered: 9 }, completed: [] },
      belts: {
        2: [{ id: 1, item: 'pc-office-packaged', position: 19 }],
        4: [{ id: 2, item: 'pc-office-packaged', position: 19 }],
      },
      ledger: { ...layout.ledger, produced: { 'pc-office-packaged': 11 } },
    };
    const result = step(world);
    expect(result.sales.completed).toHaveLength(1);
    expect(result.belts[4]).toEqual(world.belts[4]);
    expect(result.capitalCents).toBe(world.capitalCents + 650_000);
    expect(step(result).capitalCents).toBe(result.capitalCents);
    expect(checkIntegrity(result)).toBe(true);
  });
});
