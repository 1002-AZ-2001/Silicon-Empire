import { MACHINES, STAFF, WORKSHOP } from '@silicon-empire/game-data';
import { describe, expect, it, vi } from 'vitest';
import {
  Simulation, applyCommand, candidatesFor, checkBuild, createWorld, demolitionRefund, footprintOf, machineAt,
} from '../src';
import type { Command, World } from '../src';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

const tester = { kind: 'build', type: 'tester', x: 10, y: 10, rotation: 0 } as const;

describe('construction', () => {
  it('démarre avec une grille 64 × 64 vide et 25 000 €', () => {
    expect(createWorld()).toEqual({
      columns: 64, rows: 64, tick: 0, capitalCents: 2_500_000, nextMachineId: 1, nextItemId: 1,
      machines: [], stocks: {}, belts: {}, routers: {}, production: {},
      progress: { sandbox: true, completed: [], active: null, delivered: {} },
      sales: { active: null, completed: [] },
      design: null, deliveries: [], research: { active: null, delivered: {}, analysing: null, completed: [] },
      staff: {
        employees: [], candidates: candidatesFor(0), pool: 0, nextEmployeeId: 1, paidCents: 0,
        nextPayday: STAFF.payPeriodTicks, nextPool: STAFF.poolRefreshTicks,
      },
      floors: {},
      ledger: {
        purchased: {}, discarded: {}, purchaseSpentCents: 0, produced: {}, consumed: {}, delivered: {},
      },
    });
  });

  it('débite le prix exact et permet d’inspecter toute l’emprise', () => {
    const world = run(createWorld(), tester);
    expect(world.capitalCents).toBe(WORKSHOP.initialCapitalCents - MACHINES.tester.costCents);
    expect(world.machines).toEqual([
      { type: 'tester', id: 1, x: 10, y: 10, rotation: 0, paidCents: MACHINES.tester.costCents },
    ]);
    expect(machineAt(world, { x: 11, y: 10 })).toBe(world.machines[0]);
    expect(machineAt(world, { x: 10, y: 11 })).toBeUndefined();
  });

  it.each([
    { x: -1, y: 0, rotation: 0 },
    { x: 63, y: 63, rotation: 0 },
    { x: 63, y: 63, rotation: 1 },
    { x: 0.5, y: 15, rotation: 1 },
  ] as const)('refuse un placement hors grille ou non entier ($x, $y, $rotation)', (position) => {
    const command = { ...tester, ...position };
    expect(checkBuild(createWorld(), command)).toBe('out-of-bounds');
    expect(applyCommand(createWorld(), command)).toEqual({ ok: false, reason: 'out-of-bounds' });
  });

  it('accepte une emprise qui se termine exactement sur la limite', () => {
    const world = run(createWorld(), { ...tester, x: 62, y: 63 });
    expect(machineAt(world, { x: 63, y: 63 })?.type).toBe('tester');
  });

  it('refuse un chevauchement même si la case d’origine est libre', () => {
    const world = run(createWorld(), tester);
    const colliding = { ...tester, x: 9 };
    expect(checkBuild(world, colliding)).toBe('occupied');
    expect(applyCommand(world, colliding)).toEqual({ ok: false, reason: 'occupied' });
  });

  it('refuse un achat avec un centime manquant et accepte le prix exact', () => {
    const cost = MACHINES.tester.costCents;
    expect(applyCommand({ ...createWorld(), capitalCents: cost - 1 }, tester)).toEqual({
      ok: false, reason: 'insufficient-funds',
    });
    const world = run({ ...createWorld(), capitalCents: cost }, tester);
    expect(world.capitalCents).toBe(0);
  });
});

describe('rotation et démolition', () => {
  it('pivote autour de la case d’ancrage sans facturer de nouveau', () => {
    let world = run(createWorld(), tester);
    const capital = world.capitalCents;
    for (const rotation of [1, 2, 3, 0]) {
      world = run(world, { kind: 'rotate', id: 1 });
      const [machine] = world.machines;
      expect(machine).toBeDefined();
      if (!machine) throw new Error('Machine absente');
      expect(machine.rotation).toBe(rotation);
      expect(footprintOf(machine)).toEqual({
        x: 10, y: 10, width: rotation % 2 ? 1 : 2, height: rotation % 2 ? 2 : 1,
      });
    }
    expect(world.capitalCents).toBe(capital);
  });

  it('refuse une rotation en collision ou hors carte', () => {
    const blocked = run(run(createWorld(), tester), { ...tester, x: 10, y: 11 });
    expect(applyCommand(blocked, { kind: 'rotate', id: 1 })).toEqual({
      ok: false, reason: 'occupied',
    });
    const edge = run(createWorld(), { ...tester, y: 63 });
    expect(applyCommand(edge, { kind: 'rotate', id: 1 })).toEqual({
      ok: false, reason: 'out-of-bounds',
    });
  });

  it('rembourse la moitié du prix payé, arrondie au centime inférieur', () => {
    const world = run(createWorld(), tester);
    const demolished = run(world, { kind: 'demolish', id: 1 });
    expect(demolished.machines).toEqual([]);
    expect(demolished.capitalCents).toBe(2_380_000);
    expect(demolitionRefund({ ...tester, id: 1, paidCents: 101 })).toBe(50);
    expect(applyCommand(demolished, { kind: 'demolish', id: 1 })).toEqual({
      ok: false, reason: 'missing-machine',
    });
    expect(run(demolished, tester).machines[0]?.id).toBe(2);
  });

  it('produit le même état pour une suite identique de commandes', () => {
    const commands: Command[] = [
      tester, { ...tester, x: 20 }, { kind: 'rotate', id: 2 }, { kind: 'demolish', id: 1 },
    ];
    expect(commands.reduce(run, createWorld())).toEqual(commands.reduce(run, createWorld()));
  });

  it('ne publie que des commandes acceptées et conserve les anciens snapshots', () => {
    const initial = createWorld();
    const simulation = new Simulation(initial);
    const listener = vi.fn();
    const unsubscribe = simulation.subscribe(listener);
    simulation.dispatch(tester);
    const built = simulation.getSnapshot();
    simulation.dispatch(tester);
    expect(simulation.getSnapshot()).toBe(built);
    expect(initial.machines).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('command');
    unsubscribe();
    simulation.dispatch({ kind: 'demolish', id: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
