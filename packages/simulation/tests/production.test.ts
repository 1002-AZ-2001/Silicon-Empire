import { CONVEYOR, ITEMS, ITEM_TYPES, MILESTONES, RECIPES } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  addItems, applyCommand, canReceive, checkIntegrity, contentsOf, createWorld, mergeInventories, milestoneAvailable,
  modelUnlocked, productionStatus, step, tierOpen, unlockedMachines,
} from '../src';
import type { ItemType } from '@silicon-empire/game-data';
import type { Command, Inventory, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function ticks(world: World, count: number, until?: (world: World) => boolean): World {
  let current = world;
  for (let tick = 0; tick < count && !until?.(current); tick++) {
    current = step(current);
    if (!checkIntegrity(current)) throw new Error(`Monde incohérent au tick ${current.tick}`);
  }
  return current;
}

const PC_PARTS: ItemType[] = ['cpu-8c', 'ram-16g', 'ssd-1t', 'motherboard-atx', 'psu-650', 'case-standard'];

/** Dock (1), conveyors (2, 3), assembler (4) facing north, conveyor (5), storage (6). */
const assemblyLine: Command[] = [
  { kind: 'build', type: 'receiving', x: 10, y: 20, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 19, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 11, y: 18, rotation: 0 },
  { kind: 'build', type: 'assembler', x: 11, y: 16, rotation: 0 },
  { kind: 'build', type: 'conveyor', x: 12, y: 15, rotation: 0 },
  { kind: 'build', type: 'storage', x: 12, y: 14, rotation: 0 },
];

describe('production', () => {
  it('assemble des PC en consommant chaque pièce et en conservant toutes les unités', () => {
    let world = assemblyLine.reduce(run, createWorld());
    for (const item of PC_PARTS) world = run(world, { kind: 'order', id: 1, item });
    world = ticks(world, 9000, current => current.stocks[6]?.['pc-office'] === 10);
    expect(world.stocks[6]).toEqual({ 'pc-office': 10 });
    expect(world.ledger.produced).toEqual({ 'pc-office': 10 });
    expect(world.ledger.consumed).toEqual(Object.fromEntries(PC_PARTS.map(item => [item, 10])));
    expect(world.production[4]).toBeUndefined();
    expect(world.stocks[1]).toBeUndefined();
  });

  it('accepte seulement les ingrédients de sa recette, dans la limite de deux lots', () => {
    const world = assemblyLine.reduce(run, createWorld());
    expect(canReceive(world, 4, 'cpu-8c')).toBe(true);
    expect(canReceive(world, 4, 'gpu-8g')).toBe(false);
    const full = { ...world, stocks: { 4: { 'cpu-8c': 2 } } };
    expect(canReceive(full, 4, 'cpu-8c')).toBe(false);
    expect(canReceive(full, 4, 'ram-16g')).toBe(true);
  });

  it('démarre un lot de façon atomique et le termine après la durée de la recette', () => {
    const base = assemblyLine.slice(0, 4).reduce(run, createWorld());
    const stocked: World = {
      ...base,
      stocks: { 4: Object.fromEntries(PC_PARTS.map(item => [item, 1])) },
      ledger: { ...base.ledger, purchased: Object.fromEntries(PC_PARTS.map(item => [item, 1])) },
    };
    expect(productionStatus(stocked, 4)).toBe('starved');
    const started = step(stocked);
    expect(started.stocks[4]).toBeUndefined();
    expect(started.production[4]).toEqual({ batch: { item: 'pc-office', remaining: RECIPES.assembler.ticks }, output: {} });
    expect(productionStatus(started, 4)).toBe('working');
    const done = ticks(started, RECIPES.assembler.ticks);
    expect(done.production[4]).toEqual({ batch: null, output: { 'pc-office': 1 } });
    expect(checkIntegrity(done)).toBe(true);
  });

  it('garde le produit fini dans la machine quand la sortie est pleine', () => {
    const base = assemblyLine.slice(0, 4).reduce(run, createWorld());
    const parts = Object.fromEntries(PC_PARTS.map(item => [item, 2]));
    let world: World = {
      ...base,
      stocks: { 4: parts },
      production: { 4: { batch: null, output: { 'pc-office': 1 } } },
      ledger: {
        ...base.ledger,
        purchased: Object.fromEntries(PC_PARTS.map(item => [item, 3])),
        produced: { 'pc-office': 1 },
        consumed: Object.fromEntries(PC_PARTS.map(item => [item, 1])),
      },
    };
    expect(checkIntegrity(world)).toBe(true);
    world = ticks(world, RECIPES.assembler.ticks * 3);
    expect(world.production[4]?.output).toEqual({ 'pc-office': 2 });
    expect(world.production[4]?.batch).toEqual({ item: 'pc-office', remaining: 0 });
    expect(productionStatus(world, 4)).toBe('blocked');
    const demolished = run(world, { kind: 'demolish', id: 4 });
    expect(demolished.ledger.discarded).toEqual({ 'pc-office': 3 });
    expect(contentsOf(world, 4)).toEqual({ 'pc-office': 3 });
    expect(checkIntegrity(demolished)).toBe(true);
  });

  it('reprend à l’identique après sérialisation en milieu de lot', () => {
    let world = assemblyLine.reduce(run, createWorld());
    for (const item of PC_PARTS) world = run(world, { kind: 'order', id: 1, item });
    const middle = ticks(world, 1234);
    expect(middle.production[4]?.batch).not.toBeNull();
    const restored: World = JSON.parse(JSON.stringify(middle));
    expect(ticks(restored, 900)).toEqual(ticks(middle, 900));
  });
});

/** Headquarters (1) facing north, dock (2) and a four-tile line into the headquarters' west input. */
const deliveryLine: Command[] = [
  { kind: 'build', type: 'headquarters', x: 20, y: 20, rotation: 0 },
  { kind: 'build', type: 'receiving', x: 18, y: 25, rotation: 0 },
  {
    kind: 'build-line',
    tiles: [
      { x: 19, y: 24, rotation: 0 },
      { x: 19, y: 23, rotation: 1 },
      { x: 20, y: 23, rotation: 0 },
      { x: 20, y: 22, rotation: 0 },
    ],
  },
];

describe('progression', () => {
  it('limite la construction et les achats aux éléments débloqués', () => {
    const world = createWorld('progression');
    expect([...unlockedMachines(world.progress)].sort()).toEqual(['conveyor', 'generator', 'grid-connection', 'headquarters', 'receiving', 'storage']);
    expect(applyCommand(world, { kind: 'build', type: 'assembler', x: 5, y: 5, rotation: 0 })).toEqual({ ok: false, reason: 'locked' });
    const withHq = run(world, deliveryLine[0] as Command);
    expect(applyCommand(withHq, { kind: 'build', type: 'headquarters', x: 40, y: 40, rotation: 0 })).toEqual({ ok: false, reason: 'unique' });
    const withDock = run(withHq, deliveryLine[1] as Command);
    expect(applyCommand(withDock, { kind: 'order', id: 2, item: 'carton' })).toEqual({ ok: false, reason: 'locked' });
    expect(applyCommand(withDock, { kind: 'order', id: 2, item: 'pc-office' })).toEqual({ ok: false, reason: 'locked' });
    expect(checkIntegrity({ ...withDock, machines: [...withDock.machines, { id: 3, type: 'assembler', x: 5, y: 5, rotation: 0, paidCents: 1 }], nextMachineId: 4 })).toBe(false);
  });

  it('impose l’ordre du palier 0 puis ouvre les paliers 1 et 2', () => {
    const world = createWorld('progression');
    expect(applyCommand(world, { kind: 'select-milestone', milestone: 'quality-control' })).toEqual({ ok: false, reason: 'milestone-unavailable' });
    expect(applyCommand(world, { kind: 'select-milestone', milestone: 'packaging' })).toEqual({ ok: false, reason: 'milestone-unavailable' });
    const tierZeroDone = { ...world.progress, completed: ['assembly-bench', 'quality-control', 'flow-control'] as const };
    expect(milestoneAvailable({ ...tierZeroDone, completed: [...tierZeroDone.completed] }, 'packaging')).toBe(true);
    expect(milestoneAvailable({ ...tierZeroDone, completed: [...tierZeroDone.completed] }, 'regional-grant')).toBe(true);
    expect(applyCommand(createWorld(), { kind: 'select-milestone', milestone: 'assembly-bench' })).toEqual({ ok: false, reason: 'milestone-unavailable' });
  });

  it('valide un jalon avec les pièces livrées à la Direction et débloque l’établi', () => {
    let world = deliveryLine.reduce(run, createWorld('progression'));
    world = run(world, { kind: 'select-milestone', milestone: 'assembly-bench' });
    expect(canReceive(world, 1, 'case-standard')).toBe(true);
    expect(canReceive(world, 1, 'cpu-8c')).toBe(false);
    world = run(run(world, { kind: 'order', id: 2, item: 'case-standard' }), { kind: 'order', id: 2, item: 'psu-650' });
    const capital = world.capitalCents;
    world = ticks(world, 2000, current => current.progress.completed.includes('assembly-bench'));
    expect(world.progress).toEqual({ sandbox: false, completed: ['assembly-bench'], active: null, delivered: {} });
    expect(world.capitalCents).toBe(capital + MILESTONES['assembly-bench'].rewardCents);
    expect(world.ledger.delivered).toEqual({ 'case-standard': 10, 'psu-650': 10 });
    expect(unlockedMachines(world.progress).has('assembler')).toBe(true);
    expect(applyCommand(world, { kind: 'build', type: 'assembler', x: 5, y: 5, rotation: 0 }).ok).toBe(true);
  });

  it('garde les livraisons d’un jalon quand on change d’objectif', () => {
    let world = deliveryLine.reduce(run, createWorld('progression'));
    world = run(world, { kind: 'select-milestone', milestone: 'assembly-bench' });
    world = run(world, { kind: 'order', id: 2, item: 'case-standard' });
    world = ticks(world, 400, current => (current.progress.delivered['assembly-bench']?.['case-standard'] ?? 0) >= 3);
    const paused = run(world, { kind: 'select-milestone', milestone: null });
    const delivered = paused.progress.delivered['assembly-bench'];
    expect(delivered?.['case-standard']).toBeGreaterThanOrEqual(3);
    const later = ticks(paused, 200);
    expect(later.progress.delivered['assembly-bench']).toEqual(delivered);
    expect(checkIntegrity(later)).toBe(true);
  });
});

describe('convoyeur rapide', () => {
  it('avance deux fois plus vite et transmet au convoyeur normal sans perte', () => {
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'build-line', type: 'conveyor-fast', tiles: [{ x: 11, y: 9, rotation: 0 }, { x: 11, y: 8, rotation: 0 }] },
      { kind: 'build', type: 'conveyor', x: 11, y: 7, rotation: 0 },
      { kind: 'build', type: 'storage', x: 11, y: 6, rotation: 0 },
      { kind: 'order', id: 1, item: 'cpu-8c' },
    ] satisfies Command[]).reduce(run, createWorld());
    world = ticks(world, 6);
    expect(world.belts[2]?.[0]?.position).toBe(10);
    world = ticks(world, 400);
    expect(world.stocks[5]).toEqual({ 'cpu-8c': 10 });
  });
});

const BEFORE_CAMPUS = [
  'assembly-bench', 'quality-control', 'flow-control', 'packaging', 'fast-belts', 'regional-grant',
] as const;

describe('contrat phare', () => {
  it('exige les deux jalons du palier 2 et débloque le gaming en bac à sable', () => {
    const progress = createWorld('progression').progress;
    const withGrant = { ...progress, completed: BEFORE_CAMPUS.filter(id => id !== 'fast-belts') };
    const withBelts = { ...progress, completed: BEFORE_CAMPUS.filter(id => id !== 'regional-grant') };
    expect(milestoneAvailable(withGrant, 'campus-contract')).toBe(false);
    expect(milestoneAvailable(withBelts, 'campus-contract')).toBe(false);
    expect(milestoneAvailable({ ...progress, completed: BEFORE_CAMPUS }, 'campus-contract')).toBe(true);
    expect(tierOpen({ ...progress, completed: BEFORE_CAMPUS }, 3)).toBe(false);
    expect(modelUnlocked({ ...progress, completed: BEFORE_CAMPUS }, 'gaming')).toBe(false);
    expect(modelUnlocked(createWorld().progress, 'gaming')).toBe(true);
  });

  it('crédite le contrat une seule fois, garde le surplus sur la bande et ouvre le palier 3', () => {
    const initial = createWorld('progression');
    const almost = (MILESTONES['campus-contract'].cost['pc-office-packaged'] ?? 0) - 1;
    const delivered = BEFORE_CAMPUS.reduce<Inventory>(
      (inventory, id) => mergeInventories(inventory, MILESTONES[id].cost),
      { 'pc-office-packaged': almost },
    );
    const { purchased, produced } = ITEM_TYPES.reduce<{ purchased: Inventory; produced: Inventory }>(
      (ledger, item) => {
        const count = delivered[item] ?? 0;
        if (count === 0) return ledger;
        const side = ITEMS[item].unitCostCents === null ? 'produced' : 'purchased';
        return { ...ledger, [side]: addItems(ledger[side], item, count) };
      },
      { purchased: {}, produced: {} },
    );
    let world = run(initial, { kind: 'build', type: 'headquarters', x: 20, y: 20, rotation: 0 });
    world = run(world, { kind: 'build', type: 'conveyor', x: 20, y: 22, rotation: 0 });
    const front = CONVEYOR.lengthUnits - 1;
    world = {
      ...world,
      progress: {
        ...world.progress, completed: BEFORE_CAMPUS, delivered: { 'campus-contract': { 'pc-office-packaged': almost } },
      },
      nextItemId: 3,
      belts: { 2: [
        { id: 1, item: 'pc-office-packaged', position: front },
        { id: 2, item: 'pc-office-packaged', position: front - CONVEYOR.spacingUnits },
      ] },
      ledger: {
        ...world.ledger, delivered, purchased, produced: addItems(produced, 'pc-office-packaged', 2),
      },
    };
    const capital = world.capitalCents;
    world = run(world, { kind: 'select-milestone', milestone: 'campus-contract' });
    expect(checkIntegrity(world)).toBe(true);
    expect(canReceive(world, 1, 'pc-office-tested')).toBe(false);
    world = ticks(world, 40);
    expect(world.progress.completed).toEqual([...BEFORE_CAMPUS, 'campus-contract']);
    expect(world.progress.active).toBeNull();
    expect(world.progress.delivered).toEqual({});
    expect(world.belts[2]).toEqual([{ id: 2, item: 'pc-office-packaged', position: front }]);
    expect(world.capitalCents).toBe(capital + MILESTONES['campus-contract'].rewardCents);
    expect(modelUnlocked(world.progress, 'gaming')).toBe(true);
    expect(milestoneAvailable(world.progress, 'gaming-tournament')).toBe(true);
    expect(applyCommand(world, { kind: 'select-milestone', milestone: 'campus-contract' })).toEqual({
      ok: false, reason: 'milestone-unavailable',
    });
  });
});

describe('gamme gaming', () => {
  it('conserve les ingrédients compatibles quand la machine change de modèle', () => {
    let world = assemblyLine.reduce(run, createWorld());
    world = run(world, { kind: 'order', id: 1, item: 'cpu-8c' });
    world = ticks(world, 100);
    const stock = world.stocks[4];
    expect(stock).toEqual({ 'cpu-8c': 2 });
    const configured = run(world, { kind: 'set-product-model', id: 4, model: 'gaming' });
    expect(configured.stocks[4]).toBe(stock);
    expect(configured.ledger).toBe(world.ledger);
    expect(checkIntegrity(configured)).toBe(true);
  });

  it('refuse la configuration prématurée, incompatible ou pendant une fabrication', () => {
    const before = {
      ...createWorld('progression'),
      progress: { ...createWorld('progression').progress, completed: BEFORE_CAMPUS },
    };
    const locked = run(before, { kind: 'build', type: 'assembler', x: 5, y: 5, rotation: 0 });
    expect(applyCommand(locked, { kind: 'set-product-model', id: 1, model: 'gaming' })).toEqual({
      ok: false, reason: 'locked',
    });
    let world = assemblyLine.reduce(run, createWorld());
    expect(applyCommand(world, { kind: 'set-product-model', id: 1, model: 'gaming' })).toEqual({
      ok: false, reason: 'not-a-producer',
    });
    world = run(world, { kind: 'set-product-model', id: 4, model: 'gaming' });
    expect(canReceive(world, 4, 'gpu-8g')).toBe(true);
    world = run(world, { kind: 'order', id: 1, item: 'gpu-8g' });
    world = ticks(world, 100);
    expect(world.stocks[4]).toEqual({ 'gpu-8g': 2 });
    expect(applyCommand(world, { kind: 'set-product-model', id: 4, model: 'office' })).toEqual({
      ok: false, reason: 'incompatible-inputs',
    });
    // An independent office line has a batch to protect.
    world = assemblyLine.reduce(run, createWorld());
    for (const item of PC_PARTS) world = run(world, { kind: 'order', id: 1, item });
    world = ticks(world, 300, current => Boolean(current.production[4]?.batch));
    expect(world.production[4]?.batch?.item).toBe('pc-office');
    expect(applyCommand(world, { kind: 'set-product-model', id: 4, model: 'gaming' })).toEqual({
      ok: false, reason: 'production-busy',
    });
  });

  it('assemble, teste et emballe dix PC gaming avec une carte graphique par unité', () => {
    let world = ([
      ...assemblyLine.slice(0, 5),
      { kind: 'build', type: 'tester', x: 12, y: 14, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 13, y: 13, rotation: 0 },
      { kind: 'build', type: 'packager', x: 13, y: 12, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 14, y: 11, rotation: 0 },
      { kind: 'build', type: 'storage', x: 14, y: 10, rotation: 0 },
      { kind: 'build', type: 'receiving', x: 13, y: 15, rotation: 0 },
      { kind: 'build-line', tiles: [
        { x: 14, y: 14, rotation: 0 }, { x: 14, y: 13, rotation: 0 },
      ] },
      { kind: 'set-product-model', id: 4, model: 'gaming' },
      { kind: 'set-product-model', id: 6, model: 'gaming' },
      { kind: 'set-product-model', id: 8, model: 'gaming' },
      { kind: 'order', id: 11, item: 'carton' },
    ] satisfies Command[]).reduce(run, createWorld());
    for (const item of [...PC_PARTS, 'gpu-8g'] as const) world = run(world, { kind: 'order', id: 1, item });
    expect(canReceive(world, 6, 'pc-office')).toBe(false);
    expect(canReceive(world, 6, 'pc-gaming')).toBe(true);
    world = ticks(world, 11000, current => current.stocks[10]?.['pc-gaming-packaged'] === 10);
    expect(world.stocks[10]).toEqual({ 'pc-gaming-packaged': 10 });
    expect(world.ledger.produced).toEqual({ 'pc-gaming': 10, 'pc-gaming-tested': 10, 'pc-gaming-packaged': 10 });
    expect(world.ledger.consumed['gpu-8g']).toBe(10);
    expect(world.ledger.discarded).toEqual({});
  });
});
