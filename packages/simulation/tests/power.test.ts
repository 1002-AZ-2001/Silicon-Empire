import { LEVELS, MACHINES, POWER, POWER_SOURCES, RECIPES, UPGRADE_COSTS, WEAR } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, batchTicks, checkIntegrity, createWorld, monthlyPowerBill, powerOf, powerRatio, productionStatus, productionTicks,
  repairCost, step,
} from '../src';
import type { Command, Machine, Tile, World } from '../src';

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

const row = (y: number, from: number, to: number): Tile[] => Array.from({ length: to - from + 1 }, (_, index) => ({ x: from + index, y }));
const INPUTS = { 'cpu-8c': 2, 'ram-16g': 2, 'ssd-1t': 2, 'motherboard-atx': 2, 'psu-650': 2, 'case-standard': 2 };

/** Sandbox with utilities on: an assembler (id 1) and a grid connection (id 2), not yet cabled. */
function plant(): World {
  return ([
    { kind: 'build', type: 'assembler', x: 10, y: 10, rotation: 0 },
    { kind: 'build', type: 'grid-connection', x: 20, y: 11, rotation: 0 },
  ] satisfies Command[]).reduce(run, createWorld('sandbox', { utilities: true }));
}

function machine(world: World, id: number): Machine {
  const found = world.machines.find(candidate => candidate.id === id);
  if (!found) throw new Error(`machine ${id} absente`);
  return found;
}

describe('électricité', () => {
  it('ne démarre pas sans câble, puis produit à pleine vitesse une fois raccordée', () => {
    let world: World = { ...plant(), stocks: { 1: INPUTS } };
    world = { ...world, ledger: { ...world.ledger, purchased: INPUTS } };
    expect(powerRatio(world, machine(world, 1))).toBe(0);
    expect(productionStatus(world, 1)).toBe('unpowered');
    expect(step(world).production[1]).toBeUndefined();
    const before = world.capitalCents;
    world = run(world, { kind: 'lay-cable', tiles: row(12, 10, 20) });
    expect(world.capitalCents).toBe(before - 11 * POWER.cableCostCents);
    expect(powerOf(world).networks).toEqual([{ supplyKw: 150, demandKw: 10, ratio: 1, gridDemandKw: 10, generators: 0 }]);
    expect(step(world).production[1]?.batch?.remaining).toBe(RECIPES.assembler.ticks - 0);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('ralentit les machines quand la demande dépasse l’offre', () => {
    let world = run(plant(), { kind: 'lay-cable', tiles: row(12, 10, 20) });
    world = ([...Array.from({ length: 19 }, (_, index) => ({ kind: 'build', type: 'assembler', x: 10 + index * 2, y: 13, rotation: 0 }))] as Command[])
      .reduce(run, { ...world, capitalCents: 100_000_000 });
    world = run(world, { kind: 'lay-cable', tiles: row(12, 21, 48) });
    const network = powerOf(world).networks[0];
    expect(network?.demandKw).toBe(200);
    expect(network?.ratio).toBe(0.75);
    expect(productionTicks(world, machine(world, 1), RECIPES.assembler)).toBe(800);
  });

  it('facture le réseau chaque mois et coupe le courant quand la facture n’est pas payée', () => {
    const world = run(plant(), { kind: 'lay-cable', tiles: row(12, 10, 20) });
    const bill = 10 * (POWER_SOURCES['grid-connection']?.billPerKwCents ?? 0);
    expect(monthlyPowerBill(world)).toBe(bill);
    const paid = ticks(world, POWER.billPeriodTicks);
    expect(paid.capitalCents).toBe(world.capitalCents - bill);
    expect(paid.utilities).toMatchObject({ cut: false, spentCents: bill });
    expect(checkIntegrity(paid)).toBe(true);
    const unpaid = ticks({ ...world, capitalCents: 0 }, POWER.billPeriodTicks);
    expect(unpaid.utilities.cut).toBe(true);
    expect(powerRatio(unpaid, machine(unpaid, 1))).toBe(0);
  });

  it('refuse un câble hors terrain et retire un câble sans remboursement', () => {
    const world = run(plant(), { kind: 'lay-cable', tiles: row(12, 10, 12) });
    expect(applyCommand(world, { kind: 'lay-cable', tiles: [{ x: 70, y: 0 }] })).toEqual({ ok: false, reason: 'not-owned' });
    const removed = run(world, { kind: 'remove-cable', tiles: [{ x: 11, y: 12 }] });
    expect(removed.cables).toEqual([12 * 128 + 10, 12 * 128 + 12]);
    expect(removed.capitalCents).toBe(world.capitalCents);
    expect(checkIntegrity({ ...world, cables: [12 * 128 + 12, 12 * 128 + 10] })).toBe(false);
  });
});

describe('usure et améliorations', () => {
  it('use la machine à chaque lot, la bloque à l’usure maximale et la remet à neuf contre paiement', () => {
    let world = run(plant(), { kind: 'lay-cable', tiles: row(12, 10, 20) });
    world = { ...world, stocks: { 1: INPUTS }, ledger: { ...world.ledger, purchased: INPUTS } };
    world = ticks(world, RECIPES.assembler.ticks + 2);
    expect(world.wear[1]).toBe(LEVELS[1].wearPerBatch);
    const broken: World = { ...world, wear: { 1: WEAR.breakdown } };
    expect(checkIntegrity(broken)).toBe(true);
    expect(productionTicks(broken, machine(broken, 1), RECIPES.assembler)).toBeNull();
    const slow: World = { ...world, wear: { 1: WEAR.slowFrom } };
    expect(productionTicks(slow, machine(slow, 1), RECIPES.assembler)).toBe(RECIPES.assembler.ticks * WEAR.slowPercent / 100);
    const cost = repairCost(machine(broken, 1));
    expect(cost).toBe(MACHINES.assembler.costCents * WEAR.repairPercent / 100);
    const repaired = run(broken, { kind: 'repair', id: 1 });
    expect(repaired.wear).toEqual({});
    expect(repaired.capitalCents).toBe(broken.capitalCents - cost);
    expect(repaired.utilities.spentCents).toBe(cost);
    expect(applyCommand(repaired, { kind: 'repair', id: 1 })).toEqual({ ok: false, reason: 'not-worn' });
  });

  it('améliore en Mk2 puis en Mk3 : plus rapide, plus gourmande', () => {
    let world = run(run(plant(), { kind: 'upgrade', id: 1 }), { kind: 'upgrade', id: 1 });
    const upgraded = machine(world, 1);
    expect(upgraded.level).toBe(3);
    expect(upgraded.paidCents).toBe(MACHINES.assembler.costCents + (UPGRADE_COSTS.assembler?.[2] ?? 0) + (UPGRADE_COSTS.assembler?.[3] ?? 0));
    expect(batchTicks(RECIPES.assembler, upgraded)).toBe(200);
    expect(applyCommand(world, { kind: 'upgrade', id: 1 })).toEqual({ ok: false, reason: 'not-upgradable' });
    world = run(world, { kind: 'lay-cable', tiles: row(12, 10, 20) });
    expect(powerOf(world).networks[0]?.demandKw).toBe(20);
    expect(checkIntegrity(world)).toBe(true);
    const classic = createWorld('progression');
    expect(applyCommand(run({ ...classic, capitalCents: 1_000_000 }, { kind: 'build', type: 'storage', x: 5, y: 5, rotation: 0 }), { kind: 'upgrade', id: 1 }))
      .toEqual({ ok: false, reason: 'not-upgradable' });
  });
});
