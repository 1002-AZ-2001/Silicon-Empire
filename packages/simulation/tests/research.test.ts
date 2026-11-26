import { MK2, PROFESSIONAL_RECIPES, RECIPES, RESEARCH } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, batchTicks, canReceive, capacityOf, checkIntegrity, createWorld, machineUnlocked, rejectionEvery,
  researchAvailable, step,
} from '../src';
import type { Command, Progress, World } from '../src';

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

/** Storage (1) holding 20 tested office PCs, conveyor (2), laboratory (3) facing north. */
function labLine(mode: 'sandbox' | 'progression' = 'sandbox', progress?: Partial<Progress>): World {
  let world = createWorld(mode);
  if (progress) world = { ...world, progress: { ...world.progress, ...progress } };
  world = ([
    { kind: 'build', type: 'storage', x: 10, y: 12, rotation: 0 },
    { kind: 'build', type: 'conveyor', x: 10, y: 11, rotation: 0 },
    { kind: 'build', type: 'lab', x: 10, y: 9, rotation: 0 },
  ] satisfies Command[]).reduce(run, world);
  return {
    ...world,
    stocks: { 1: { 'pc-office-tested': 20 } },
    ledger: { ...world.ledger, produced: { 'pc-office-tested': 20 } },
  };
}

const TIER_ZERO: Partial<Progress> = { completed: ['assembly-bench', 'quality-control', 'flow-control'] };

/** Records the parts of milestones marked completed in a test world, so the ledger stays balanced. */
function withTierZero(world: World): World {
  const delivered = { 'case-standard': 10, 'psu-650': 10, 'pc-office': 5, 'pc-office-tested': 10 };
  return {
    ...world,
    progress: { ...world.progress, completed: [...TIER_ZERO.completed ?? []] },
    ledger: {
      ...world.ledger,
      purchased: { ...world.ledger.purchased, 'case-standard': 10, 'psu-650': 10 },
      produced: { ...world.ledger.produced, 'pc-office': 5, 'pc-office-tested': (world.ledger.produced['pc-office-tested'] ?? 0) + 10 },
      delivered,
    },
  };
}

describe('recherche', () => {
  it('ouvre le laboratoire au jalon Contrôle qualité et les projets selon leurs prérequis', () => {
    const start = createWorld('progression');
    expect(machineUnlocked(start, 'lab')).toBe(false);
    const tested = { ...start, progress: { ...start.progress, completed: ['assembly-bench', 'quality-control'] as Progress['completed'] } };
    expect(machineUnlocked(tested, 'lab')).toBe(true);
    expect(researchAvailable(tested.progress, tested.research, 'assembly-mk2')).toBe(false);
    expect(applyCommand(tested, { kind: 'select-research', research: 'assembly-mk2' })).toEqual({ ok: false, reason: 'research-unavailable' });
    const flow = { ...tested.progress, completed: [...tested.progress.completed, 'flow-control'] as Progress['completed'] };
    expect(researchAvailable(flow, tested.research, 'assembly-mk2')).toBe(true);
    expect(researchAvailable(flow, tested.research, 'packaging-mk2')).toBe(false);
  });

  it('reçoit les pièces au laboratoire, analyse le projet puis débloque l’établi Mk2', () => {
    let world = run(withTierZero(labLine('progression', TIER_ZERO)), { kind: 'select-research', research: 'assembly-mk2' });
    expect(canReceive(world, 3, 'pc-office-tested')).toBe(true);
    expect(canReceive(world, 3, 'pc-office')).toBe(false);
    world = ticks(world, 400, current => current.research.analysing !== null);
    expect(world.research).toMatchObject({ active: null, delivered: {}, analysing: { id: 'assembly-mk2', remaining: RESEARCH['assembly-mk2'].ticks } });
    expect(world.ledger.delivered['pc-office-tested']).toBe(30);
    world = ticks(world, RESEARCH['assembly-mk2'].ticks);
    expect(world.research.completed).toEqual(['assembly-mk2']);
    expect(world.research.analysing).toBeNull();
  });

  it('suspend l’analyse sans laboratoire et la reprend après reconstruction', () => {
    let world = run(labLine(), { kind: 'select-research', research: 'dock-expansion' });
    world = { ...world, stocks: { 1: { 'pc-office-tested': 30 } }, ledger: { ...world.ledger, produced: { 'pc-office-tested': 30 } } };
    world = ticks(world, 600, current => current.research.analysing !== null);
    world = ticks(world, 10);
    const remaining = world.research.analysing?.remaining ?? 0;
    world = run(world, { kind: 'demolish', id: 3 });
    world = ticks(world, 100);
    expect(world.research.analysing?.remaining).toBe(remaining);
    world = run(world, { kind: 'build', type: 'lab', x: 20, y: 20, rotation: 0 });
    world = ticks(world, remaining);
    expect(world.research.completed).toEqual(['dock-expansion']);
    expect(capacityOf(world.progress, world.research, 'receiving')).toBe(200);
  });

  it('accepte un nouveau projet pendant une analyse et le lance ensuite', () => {
    let world = run(labLine(), { kind: 'select-research', research: 'assembly-mk2' });
    world = ticks(world, 400, current => current.research.analysing !== null);
    expect(applyCommand(world, { kind: 'select-research', research: 'testing-mk2' })).toEqual({ ok: false, reason: 'research-unavailable' });
    world = run(world, { kind: 'select-research', research: 'dock-expansion' });
    expect(world.research.active).toBe('dock-expansion');
    expect(applyCommand(world, { kind: 'select-research', research: 'assembly-mk2' })).toEqual({ ok: false, reason: 'research-unavailable' });
    expect(checkIntegrity(world)).toBe(true);
    const restored: World = JSON.parse(JSON.stringify(world));
    expect(ticks(restored, 300)).toEqual(ticks(world, 300));
  });
});

describe('machines Mk2', () => {
  const assembler: Command = { kind: 'build', type: 'assembler', x: 30, y: 30, rotation: 0 };

  it('améliore une machine sur place après la recherche et facture une seule fois', () => {
    const unlocked = withTierZero(createWorld('progression'));
    const built = run(unlocked, assembler);
    expect(applyCommand(built, { kind: 'upgrade', id: 1 })).toEqual({ ok: false, reason: 'not-upgradable' });
    const researched: World = {
      ...built,
      research: { ...built.research, completed: ['assembly-mk2'] },
      ledger: {
        ...built.ledger,
        produced: { ...built.ledger.produced, 'pc-office-tested': (built.ledger.produced['pc-office-tested'] ?? 0) + 20 },
        delivered: { ...built.ledger.delivered, 'pc-office-tested': (built.ledger.delivered['pc-office-tested'] ?? 0) + 20 },
      },
    };
    expect(checkIntegrity(researched)).toBe(true);
    const upgraded = run(researched, { kind: 'upgrade', id: 1 });
    expect(upgraded.machines[0]).toMatchObject({ level: 2, paidCents: 180_000 + MK2.costCents.assembler });
    expect(upgraded.capitalCents).toBe(researched.capitalCents - MK2.costCents.assembler);
    expect(applyCommand(upgraded, { kind: 'upgrade', id: 1 })).toEqual({ ok: false, reason: 'not-upgradable' });
    expect(applyCommand({ ...researched, capitalCents: 1 }, { kind: 'upgrade', id: 1 })).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(checkIntegrity(upgraded)).toBe(true);
    expect(checkIntegrity({ ...upgraded, research: built.research })).toBe(false);
  });

  it('divise par deux la durée d’un lot', () => {
    expect(batchTicks(RECIPES.assembler, undefined)).toBe(600);
    expect(batchTicks(RECIPES.assembler, { id: 1, type: 'assembler', x: 0, y: 0, rotation: 0, paidCents: 1, level: 2 })).toBe(600 / MK2.speed);
  });

  it('autorise les améliorations en bac à sable sans recherche', () => {
    const upgraded = run(run(createWorld(), assembler), { kind: 'upgrade', id: 1 });
    expect(upgraded.machines[0]?.level).toBe(2);
    expect(checkIntegrity(upgraded)).toBe(true);
  });

  it('réduit les rebuts professionnels après la recherche sur la conformité', () => {
    const world = createWorld();
    expect(rejectionEvery(world.progress, world.research, PROFESSIONAL_RECIPES.tester)).toBe(8);
    expect(rejectionEvery(world.progress, { ...world.research, completed: ['yield-control'] }, PROFESSIONAL_RECIPES.tester)).toBe(16);
    expect(rejectionEvery(world.progress, world.research, RECIPES.tester)).toBeNull();
  });

  it('débloque le convoyeur express par la recherche et le fait avancer de quatre unités', () => {
    const progression = createWorld('progression');
    expect(machineUnlocked(progression, 'conveyor-express')).toBe(false);
    expect(machineUnlocked({ ...progression, research: { ...progression.research, completed: ['express-belts'] } }, 'conveyor-express')).toBe(true);
    let world = ([
      { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 },
      { kind: 'build-line', type: 'conveyor-express', tiles: [{ x: 11, y: 9, rotation: 0 }, { x: 11, y: 8, rotation: 0 }] },
      { kind: 'build', type: 'storage', x: 11, y: 7, rotation: 0 },
      { kind: 'order', id: 1, item: 'cpu-8c' },
    ] satisfies Command[]).reduce(run, createWorld());
    world = ticks(world, 4);
    expect(world.belts[2]?.[0]?.position).toBe(12);
    world = ticks(world, 200);
    expect(world.stocks[4]).toEqual({ 'cpu-8c': 10 });
  });
});
