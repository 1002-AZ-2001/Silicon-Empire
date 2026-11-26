import { DEFAULT_DESIGN, RECIPES, SUPPLIERS, designParts, saleOffer } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import { applyCommand, canReceive, checkIntegrity, createWorld, orderCost, salesAccounts, step } from '../src';
import type { ItemType } from '@silicon-empire/game-data';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

const dock = { kind: 'build', type: 'shipping', x: 14, y: 9, rotation: 0 } as const;
const start = { kind: 'start-sale', model: 'office' } as const;

const factory = [
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
] satisfies Command[];

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
    let world = run(factory.reduce(run, createWorld()), start);
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

describe('fournisseurs', () => {
  it('réserve le quai, encaisse immédiatement et livre une fois à échéance', () => {
    let world = run(createWorld(), { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 });
    const initial = world.capitalCents;
    const order = { kind: 'order', id: 1, item: 'carton', supplier: 'economy' } as const;
    for (let lot = 0; lot < 10; lot++) world = run(world, order);
    expect(world.capitalCents).toBe(initial - orderCost('carton', 'economy') * 10);
    expect(world.stocks[1]).toBeUndefined();
    expect(world.deliveries).toHaveLength(10);
    expect(applyCommand(world, { ...order, supplier: 'express' })).toEqual({ ok: false, reason: 'dock-full' });
    expect(applyCommand(world, { kind: 'demolish', id: 1 })).toEqual({ ok: false, reason: 'deliveries-pending' });
    expect(checkIntegrity(world)).toBe(true);
    const before = step({ ...world, tick: SUPPLIERS.economy.leadTicks - 2 });
    expect(before.stocks[1]).toBeUndefined();
    const receive = step(before);
    expect(receive.stocks[1]).toEqual({ carton: 100 });
    expect(receive.ledger.purchased).toEqual({ carton: 100 });
    expect(receive.deliveries).toEqual([]);
    expect(receive.capitalCents).toBe(world.capitalCents);
    expect(checkIntegrity(receive)).toBe(true);
    expect(step(receive).ledger.purchased).toEqual({ carton: 100 });
  });
});

describe('conception sur mesure', () => {
  it('refuse une alimentation insuffisante et protège la nomenclature d’une vente', () => {
    let world = factory.reduce(run, createWorld());
    const first = { ...DEFAULT_DESIGN, name: 'Nacre' };
    expect(applyCommand(world, { kind: 'publish-design', spec: { ...first, graphics: 'gpu-8g' } })).toEqual({
      ok: false, reason: 'design-power',
    });
    world = run(world, { kind: 'publish-design', spec: first });
    for (const id of [4, 6, 8]) world = run(world, { kind: 'set-product-model', id, model: 'custom' });
    world = run(world, { kind: 'start-sale', model: 'custom' });
    const second = { ...first, name: 'Nacre Plus', memory: 'ram-32g' } as const;
    expect(applyCommand(world, { kind: 'publish-design', spec: second })).toEqual({ ok: false, reason: 'design-in-use' });
    for (const item of Object.keys(designParts(first)) as ItemType[]) world = run(world, { kind: 'order', id: 1, item });
    for (let tick = 0; tick < 10_500 && world.sales.active; tick++) world = step(world);
    expect(world.sales.completed[0]).toMatchObject({ model: 'custom', revision: 1, design: { spec: first } });
    expect(world.ledger.consumed['psu-450']).toBe(10);
    const newer = run(world, { kind: 'publish-design', spec: second });
    expect(newer.design?.revision).toBe(2);
    expect(newer.sales.completed[0]?.design?.spec.name).toBe('Nacre');
    expect(canReceive(newer, 4, 'ram-32g')).toBe(true);
    expect(canReceive(newer, 4, 'ram-16g')).toBe(false);
    expect(checkIntegrity(newer)).toBe(true);
  });
});
