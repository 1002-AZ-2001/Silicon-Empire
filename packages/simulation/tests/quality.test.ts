import { CONVEYOR, PROFESSIONAL_RECIPES, PRODUCTION } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, canReceive, checkIntegrity, createWorld, milestoneAvailable, modelUnlocked, orderableItems,
  portConnections, portsOf, productionStatus, step,
} from '../src';
import type { ItemType } from '@silicon-empire/game-data';
import type { Command, World } from '../src';

const assembled = 'pc-professional';
const approved = PROFESSIONAL_RECIPES.tester.output;
const rejected = PROFESSIONAL_RECIPES.tester.rejection.item;
const packaged = PROFESSIONAL_RECIPES.packager.output;

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function advance(world: World, count: number, until?: (world: World) => boolean): World {
  for (let tick = 0; tick < count && !until?.(world); tick++) world = step(world);
  expect(checkIntegrity(world)).toBe(true);
  return world;
}

describe('palier 4', () => {
  it('débloque les postes de travail et leurs composants avec le tournoi', () => {
    const initial = createWorld('progression').progress;
    const before = {
      ...initial,
      completed: [
        'assembly-bench', 'quality-control', 'flow-control', 'packaging', 'fast-belts', 'regional-grant', 'campus-contract',
      ] as const,
    };
    const after = { ...before, completed: [...before.completed, 'gaming-tournament'] as const };
    expect(modelUnlocked(before, 'professional')).toBe(false);
    expect(orderableItems(before).has('ram-32g')).toBe(false);
    expect(orderableItems(before).has('ssd-2t')).toBe(false);
    expect(milestoneAvailable(before, 'professional-rollout')).toBe(false);
    expect(modelUnlocked(after, 'professional')).toBe(true);
    expect(orderableItems(after).has('ram-32g')).toBe(true);
    expect(orderableItems(after).has('ssd-2t')).toBe(true);
    expect(milestoneAvailable(after, 'professional-rollout')).toBe(true);
    expect(modelUnlocked(createWorld().progress, 'professional')).toBe(true);
  });
});

describe('contrôle qualité professionnel', () => {
  it('ajoute une sortie de rebut qui pivote avec le modèle professionnel', () => {
    const bench = { x: 10, y: 10, type: 'tester' } as const;
    expect(portsOf({ ...bench, rotation: 0 }).map(port => port.kind)).toEqual(['input', 'output']);
    expect(portsOf({ ...bench, rotation: 0, model: 'gaming' }).map(port => port.kind)).toEqual(['input', 'output']);
    expect(portsOf({ ...bench, rotation: 1, model: 'professional' })).toContainEqual({
      kind: 'reject', tile: { x: 10, y: 11 }, side: 2,
    });
    expect(portsOf({ ...bench, rotation: 3, model: 'professional' })).toContainEqual({
      kind: 'reject', tile: { x: 10, y: 10 }, side: 0,
    });
  });

  it('assemble et teste dix PC, met le huitième à part et emballe les neuf autres', () => {
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 20, rotation: 0 },
      { kind: 'build-line', tiles: [{ x: 11, y: 19, rotation: 0 }, { x: 11, y: 18, rotation: 0 }] },
      { kind: 'build', type: 'assembler', x: 11, y: 16, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 12, y: 15, rotation: 0 },
      { kind: 'build', type: 'tester', x: 12, y: 14, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 13, y: 13, rotation: 0 },
      { kind: 'build', type: 'packager', x: 13, y: 12, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 14, y: 11, rotation: 0 },
      { kind: 'build', type: 'storage', x: 14, y: 10, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 14, y: 14, rotation: 1 },
      { kind: 'build', type: 'receiving', x: 17, y: 12, rotation: 3 },
      { kind: 'build-line', tiles: [
        { x: 16, y: 13, rotation: 3 }, { x: 15, y: 13, rotation: 3 }, { x: 14, y: 13, rotation: 0 },
      ] },
      { kind: 'set-product-model', id: 4, model: 'professional' },
      { kind: 'set-product-model', id: 6, model: 'professional' },
      { kind: 'set-product-model', id: 8, model: 'professional' },
      { kind: 'order', id: 12, item: 'carton' },
    ] satisfies Command[]).reduce(run, createWorld());
    for (const item of Object.keys(PROFESSIONAL_RECIPES.assembler.inputs) as ItemType[]) {
      world = run(world, { kind: 'order', id: 1, item });
    }
    expect(canReceive(world, 8, rejected)).toBe(false);
    expect(canReceive(world, 8, approved)).toBe(true);
    world = advance(world, 13_000, current => current.stocks[10]?.[packaged] === 9);
    expect(world.stocks[10]).toEqual({ [packaged]: 9 });
    expect(world.belts[11]).toMatchObject([{ item: rejected, position: CONVEYOR.lengthUnits - 1 }]);
    expect(world.ledger.produced).toEqual({ [assembled]: 10, [approved]: 9, [rejected]: 1, [packaged]: 9 });
    expect(world.ledger.consumed).toMatchObject({ 'ram-32g': 10, 'ssd-2t': 10, [assembled]: 10, [approved]: 9 });
  });

  it('compte les contrôles dans le même ordre sur plusieurs bancs après sérialisation', () => {
    const world = ([
      { kind: 'build', type: 'tester', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'tester', x: 14, y: 10, rotation: 0 },
      { kind: 'set-product-model', id: 1, model: 'professional' },
      { kind: 'set-product-model', id: 2, model: 'professional' },
    ] satisfies Command[]).reduce(run, createWorld());
    const ready: World = {
      ...world,
      stocks: { 1: { [assembled]: 1 }, 2: { [assembled]: 1 } },
      ledger: {
        ...world.ledger,
        produced: { [assembled]: 9, [approved]: 7 },
        consumed: { [assembled]: 7 },
        discarded: { [approved]: 7 },
      },
    };
    const after = advance(ready, 1);
    expect(after.production[1]?.batch?.item).toBe(rejected);
    expect(after.production[2]?.batch?.item).toBe(approved);
    const resumed: World = JSON.parse(JSON.stringify(after));
    expect(advance(resumed, PROFESSIONAL_RECIPES.tester.ticks)).toEqual(advance(after, PROFESSIONAL_RECIPES.tester.ticks));
  });

  it('retient un PC quand les rebuts saturent et reprend quand leur sortie est raccordée', () => {
    let world = ([
      { kind: 'build', type: 'tester', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 11, y: 9, rotation: 0 },
      { kind: 'build', type: 'storage', x: 11, y: 8, rotation: 0 },
      { kind: 'set-product-model', id: 1, model: 'professional' },
    ] satisfies Command[]).reduce(run, createWorld());
    world = {
      ...world,
      stocks: { 1: { [assembled]: 2 } },
      production: { 1: { batch: null, output: { [rejected]: PRODUCTION.outputCapacity } } },
      ledger: {
        ...world.ledger,
        produced: { [assembled]: 25, [approved]: 21, [rejected]: 2 },
        consumed: { [assembled]: 23 },
        discarded: { [approved]: 21 },
      },
    };
    expect(checkIntegrity(world)).toBe(true);
    world = advance(world, PROFESSIONAL_RECIPES.tester.ticks + 1);
    expect(productionStatus(world, 1)).toBe('reject-blocked');
    expect(world.production[1]?.batch).toEqual({ item: rejected, remaining: 0 });
    expect(world.stocks[3]).toBeUndefined();

    world = run(world, { kind: 'build', type: 'conveyor', x: 12, y: 10, rotation: 1 });
    world = run(world, { kind: 'build', type: 'storage', x: 13, y: 10, rotation: 1 });
    const tester = world.machines[0];
    if (!tester) throw new Error('Le banc de test est absent.');
    expect(portConnections(world, tester)).toContainEqual({
      kind: 'reject', side: 1, tile: { x: 11, y: 10 }, connected: true,
    });
    world = advance(world, PROFESSIONAL_RECIPES.tester.ticks + 60);
    expect(world.stocks[3]).toEqual({ [approved]: 1 });
    expect(world.stocks[5]).toEqual({ [rejected]: 3 });
    expect(productionStatus(world, 1)).toBe('starved');
    expect(world.production[1]).toBeUndefined();
  });
});
