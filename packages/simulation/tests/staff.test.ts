import { RECIPES, ROLE_EFFECTS, STAFF } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, assignBaseOperators, batchTicks, candidatesFor, checkIntegrity, createWorld, operatorOf, payroll,
  severance, staffRequired, step, withRequiredStaff,
} from '../src';
import type { Command, Progress, World } from '../src';

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

const assembler: Command = { kind: 'build', type: 'assembler', x: 30, y: 30, rotation: 0 };
const PACKAGING: Progress['completed'] = ['assembly-bench', 'quality-control', 'flow-control', 'packaging'];

describe('personnel', () => {
  it('tire un vivier déterministe et le renouvelle à rythme fixe', () => {
    const pool = candidatesFor(0);
    expect(pool).toEqual(candidatesFor(0));
    expect(pool).toHaveLength(STAFF.poolSize);
    expect(pool.map(candidate => candidate.id)).toEqual([0, 1, 2, 3, 4]);
    for (const candidate of pool) {
      const base = STAFF.baseSalaryCents[candidate.skill] * ROLE_EFFECTS.salaryPercent[candidate.role] / 100;
      expect(candidate.salaryCents).toBeGreaterThanOrEqual(base * 85 / 100);
      expect(candidate.salaryCents).toBeLessThanOrEqual(base * 115 / 100);
      expect(candidate.name).toMatch(/^\S+ \S+$/);
    }
    const later = ticks(createWorld(), STAFF.poolRefreshTicks);
    expect(later.staff.pool).toBe(1);
    expect(later.staff.candidates).toEqual(candidatesFor(1));
    expect(candidatesFor(1)).not.toEqual(pool);
  });

  it('embauche un candidat, l’affecte à une machine et le licencie avec indemnité', () => {
    let world = run(createWorld(), assembler);
    const candidate = world.staff.candidates[0];
    if (!candidate) throw new Error('vivier vide');
    world = run(world, { kind: 'hire', candidate: candidate.id });
    expect(world.staff.candidates).toHaveLength(STAFF.poolSize - 1);
    expect(world.staff.employees).toEqual([{ ...candidate, id: 1, morale: STAFF.morale.initial, machineId: null }]);
    expect(applyCommand(world, { kind: 'hire', candidate: candidate.id })).toEqual({ ok: false, reason: 'missing-candidate' });

    world = run(world, { kind: 'assign', employee: 1, machine: 1 });
    expect(operatorOf(world.staff, 1)?.id).toBe(1);
    expect(checkIntegrity(world)).toBe(true);
    const storage = run(world, { kind: 'build', type: 'storage', x: 10, y: 10, rotation: 0 });
    expect(applyCommand(storage, { kind: 'assign', employee: 1, machine: 2 })).toEqual({ ok: false, reason: 'not-staffed' });

    const employee = world.staff.employees[0];
    if (!employee) throw new Error('aucun employé');
    const fired = run(world, { kind: 'fire', employee: 1 });
    expect(fired.staff.employees).toEqual([]);
    expect(fired.capitalCents).toBe(world.capitalCents - severance(employee));
    expect(fired.staff.paidCents).toBe(severance(employee));
    expect(checkIntegrity(fired)).toBe(true);
  });

  it('libère l’ancien opérateur d’une machine et celui d’une machine démolie', () => {
    let world = run(createWorld(), assembler);
    // The third pool opens with two operators.
    world = { ...world, staff: { ...world.staff, pool: 2, candidates: candidatesFor(2) } };
    const [first, second] = world.staff.candidates;
    if (!first || !second) throw new Error('vivier vide');
    world = run(run(world, { kind: 'hire', candidate: first.id }), { kind: 'hire', candidate: second.id });
    world = run(world, { kind: 'assign', employee: 1, machine: 1 });
    world = run(world, { kind: 'assign', employee: 2, machine: 1 });
    expect(world.staff.employees.map(employee => employee.machineId)).toEqual([null, 1]);
    world = run(world, { kind: 'demolish', id: 1 });
    expect(world.staff.employees.map(employee => employee.machineId)).toEqual([null, null]);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('verse les salaires chaque mois, sinon le moral baisse jusqu’au départ', () => {
    let world = createWorld();
    const [first] = world.staff.candidates;
    if (!first) throw new Error('vivier vide');
    world = run(world, { kind: 'hire', candidate: first.id });
    const paid = ticks(world, STAFF.payPeriodTicks);
    expect(paid.capitalCents).toBe(world.capitalCents - payroll(world.staff));
    expect(paid.staff.paidCents).toBe(first.salaryCents);
    expect(paid.staff.employees[0]?.morale).toBe(STAFF.morale.initial + STAFF.morale.paid);
    expect(checkIntegrity(paid)).toBe(true);

    const broke = { ...world, capitalCents: 0 };
    const once = ticks(broke, STAFF.payPeriodTicks);
    expect(once.staff.employees[0]?.morale).toBe(STAFF.morale.initial - STAFF.morale.unpaid);
    expect(once.staff.paidCents).toBe(0);
    const twice = ticks(once, STAFF.payPeriodTicks);
    expect(twice.staff.employees).toEqual([]);
  });

  it('adapte la durée des lots et les rebuts à la compétence de l’opérateur', () => {
    expect(batchTicks(RECIPES.assembler, undefined)).toBe(600);
    expect(batchTicks(RECIPES.assembler, undefined, 1)).toBe(750);
    expect(batchTicks(RECIPES.assembler, undefined, 3)).toBe(600);
    expect(batchTicks(RECIPES.assembler, undefined, 5)).toBe(480);
    const mk2 = { id: 1, type: 'assembler' as const, x: 0, y: 0, rotation: 0 as const, paidCents: 1, level: 2 as const };
    expect(batchTicks(RECIPES.assembler, mk2, 5)).toBe(240);
  });

  it('exige un opérateur en progression après le Conditionnement, jamais en bac à sable', () => {
    const sandbox = createWorld();
    expect(staffRequired({ ...sandbox.progress, completed: PACKAGING })).toBe(false);
    const progression = createWorld('progression');
    expect(staffRequired(progression.progress)).toBe(false);
    expect(staffRequired({ ...progression.progress, completed: PACKAGING })).toBe(true);

    const built = run(createWorld(), assembler);
    const inputs = { 'cpu-8c': 1, 'ram-16g': 1, 'ssd-1t': 1, 'motherboard-atx': 1, 'psu-650': 1, 'case-standard': 1 };
    const required: World = { ...built, progress: { ...progression.progress, completed: PACKAGING }, stocks: { 1: inputs } };
    expect(step(required).production[1]).toBeUndefined();
    const staffed = withRequiredStaff(required);
    expect(staffed.staff.employees).toMatchObject([{ id: 1, skill: STAFF.baseOperatorSkill, machineId: 1 }]);
    expect(step(staffed).production[1]?.batch?.remaining).toBe(batchTicks(RECIPES.assembler, undefined, STAFF.baseOperatorSkill) - 0);
    expect(assignBaseOperators(staffed.staff, staffed.machines)).toBe(staffed.staff);
  });

  it('refuse un vivier ou des affectations incohérents', () => {
    let world = run(createWorld(), assembler);
    const [first, second] = world.staff.candidates;
    if (!first || !second) throw new Error('vivier vide');
    world = run(run(world, { kind: 'hire', candidate: first.id }), { kind: 'hire', candidate: second.id });
    expect(checkIntegrity(world)).toBe(true);
    const doubled = world.staff.employees.map(employee => ({ ...employee, machineId: 1 }));
    expect(checkIntegrity({ ...world, staff: { ...world.staff, employees: doubled } })).toBe(false);
    const forged = world.staff.candidates.map(candidate => ({ ...candidate, salaryCents: 1 }));
    expect(checkIntegrity({ ...world, staff: { ...world.staff, candidates: forged } })).toBe(false);
    expect(checkIntegrity({ ...world, staff: { ...world.staff, paidCents: world.capitalCents * 10 } })).toBe(false);
  });
});
