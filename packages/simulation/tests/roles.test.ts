import { ITEMS, PURCHASE, RECIPES, ROLE_EFFECTS, STAFF, UPGRADE_COSTS, saleOffer } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, createWorld, equippedByRole, productionTicks, roleUnlocked, salesBonusPercent, step, upgradeCost,
  workstations,
} from '../src';
import type { Command, Employee, LineTile, Tile, World } from '../src';
import type { Role } from '@silicon-empire/game-data';

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

/** Adds employees of the given roles directly, as if hired earlier. */
function employ(world: World, ...roles: Role[]): World {
  const employees: Employee[] = roles.map((role, index) => ({
    id: world.staff.nextEmployeeId + index, name: `Test ${index}`, role, skill: 3, salaryCents: 100_000, morale: 70, machineId: null,
  }));
  return { ...world, staff: { ...world.staff, employees: [...world.staff.employees, ...employees], nextEmployeeId: world.staff.nextEmployeeId + roles.length } };
}

function outline(x: number, y: number, width: number, height: number): LineTile[] {
  const path: Tile[] = [];
  for (let column = x; column < x + width; column++) path.push({ x: column, y });
  for (let row = y + 1; row < y + height; row++) path.push({ x: x + width - 1, y: row });
  for (let column = x + width - 2; column >= x; column--) path.push({ x: column, y: y + height - 1 });
  for (let row = y + height - 2; row > y; row--) path.push({ x, y: row });
  return path.map(tile => ({ ...tile, rotation: 0 }));
}

/** Sandbox with an office (desk at 41,41) and `count` workstations inside. */
function office(count: number): World {
  let world = run(createWorld(), { kind: 'build-line', type: 'wall', tiles: outline(40, 40, 8, 5) });
  world = run(world, { kind: 'build', type: 'desk', x: 41, y: 41, rotation: 0 });
  for (let index = 0; index < count; index++) world = run(world, { kind: 'build', type: 'workstation', x: 41 + index, y: 43, rotation: 0 });
  return world;
}

describe('rôles', () => {
  it('ouvre les rôles avec la progression et refuse d’embaucher un rôle verrouillé', () => {
    const classic = createWorld('progression');
    expect(roleUnlocked(classic, 'operator', false)).toBe(true);
    expect(roleUnlocked(classic, 'storekeeper', false)).toBe(false);
    expect(roleUnlocked({ ...classic, progress: { ...classic.progress, completed: ['assembly-bench', 'quality-control', 'flow-control', 'packaging', 'warehouse'] } }, 'storekeeper', false)).toBe(true);
    expect(roleUnlocked(classic, 'researcher', true)).toBe(true);
    const locked = classic.staff.candidates.find(candidate => !roleUnlocked(classic, candidate.role, false));
    if (!locked) throw new Error('aucun rôle verrouillé dans le vivier');
    expect(applyCommand(classic, { kind: 'hire', candidate: locked.id })).toEqual({ ok: false, reason: 'locked' });
  });

  it('affecte les opérateurs aux machines et les magasiniers aux quais seulement', () => {
    let world = ([
      { kind: 'build', type: 'assembler', x: 10, y: 10, rotation: 0 },
      { kind: 'build', type: 'receiving', x: 20, y: 10, rotation: 0 },
    ] satisfies Command[]).reduce(run, employ(createWorld(), 'operator', 'storekeeper', 'sales'));
    expect(applyCommand(world, { kind: 'assign', employee: 1, machine: 2 })).toEqual({ ok: false, reason: 'not-staffed' });
    expect(applyCommand(world, { kind: 'assign', employee: 2, machine: 1 })).toEqual({ ok: false, reason: 'not-staffed' });
    expect(applyCommand(world, { kind: 'assign', employee: 3, machine: 1 })).toEqual({ ok: false, reason: 'not-staffed' });
    world = run(run(world, { kind: 'assign', employee: 1, machine: 1 }), { kind: 'assign', employee: 2, machine: 2 });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('réassort : le magasinier commande un lot de ce qui manque à son quai', () => {
    let world = run(employ(createWorld(), 'storekeeper'), { kind: 'build', type: 'receiving', x: 20, y: 10, rotation: 0 });
    world = run(run(world, { kind: 'assign', employee: 1, machine: 1 }), { kind: 'set-restock', id: 1, items: ['cpu-8c', 'ram-16g'] });
    expect(applyCommand(world, { kind: 'set-restock', id: 1, items: ['pc-office'] })).toEqual({ ok: false, reason: 'invalid-order' });
    const before = world.capitalCents;
    world = ticks(world, ROLE_EFFECTS.restockTicks);
    expect(world.stocks[1]).toEqual({ 'cpu-8c': PURCHASE.lotSize });
    expect(world.capitalCents).toBe(before - (ITEMS['cpu-8c'].unitCostCents ?? 0) * PURCHASE.lotSize);
    world = ticks(world, ROLE_EFFECTS.restockTicks);
    expect(world.stocks[1]).toEqual({ 'cpu-8c': PURCHASE.lotSize, 'ram-16g': PURCHASE.lotSize });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('le technicien répare la machine la plus usée', () => {
    let world = run(employ(createWorld('sandbox', { utilities: true }), 'technician'), { kind: 'build', type: 'assembler', x: 10, y: 10, rotation: 0 });
    world = { ...world, wear: { 1: 100 } };
    world = ticks(world, ROLE_EFFECTS.repairTicks);
    expect(world.wear[1]).toBe(100 - ROLE_EFFECTS.repairPerSkill * 3);
  });

  it('les rôles de bureau n’agissent qu’avec un poste informatique dans un bureau', () => {
    const bare = employ(createWorld(), 'sales', 'designer');
    expect(salesBonusPercent(bare)).toBe(0);
    const equipped = employ(office(1), 'sales', 'designer');
    expect(workstations(equipped)).toBe(1);
    expect(equippedByRole(equipped)).toMatchObject({ sales: 1, designer: 0 });
    expect(salesBonusPercent(equipped)).toBe(ROLE_EFFECTS.salesPercent);
    const both = employ(office(2), 'sales', 'designer');
    const assembler = run(both, { kind: 'build', type: 'assembler', x: 10, y: 10, rotation: 0 });
    const machine = assembler.machines.at(-1);
    if (!machine) throw new Error('établi absent');
    expect(upgradeCost(assembler, machine, 2)).toBe((UPGRADE_COSTS.assembler?.[2] ?? 0) * 90 / 100);
  });

  it('le commercial relève le prix d’une commande client, le développeur accélère le test', () => {
    let world = employ(office(2), 'sales', 'developer');
    world = ([
      { kind: 'build', type: 'shipping', x: 10, y: 20, rotation: 0 },
      { kind: 'build', type: 'tester', x: 10, y: 10, rotation: 0 },
      { kind: 'start-sale', model: 'office' },
    ] satisfies Command[]).reduce(run, world);
    const offer = saleOffer('office', null);
    expect(world.sales.active?.terms.unitPriceCents).toBe(Math.ceil((offer?.unitPriceCents ?? 0) * 105 / 100));
    expect(checkIntegrity(world)).toBe(true);
    const tester = world.machines.find(machine => machine.type === 'tester');
    if (!tester) throw new Error('banc absent');
    expect(productionTicks(world, tester, RECIPES.tester)).toBe(Math.ceil(RECIPES.tester.ticks * 90 / 100));
  });

  it('change la couleur et l’emblème de l’entreprise', () => {
    const world = run(createWorld(), { kind: 'brand', company: { color: 'sky', emblem: 'bolt' } });
    expect(world.company).toEqual({ color: 'sky', emblem: 'bolt' });
    expect(applyCommand(world, { kind: 'brand', company: { color: 'gold' as 'sky', emblem: 'bolt' } })).toEqual({ ok: false, reason: 'invalid-order' });
    expect(checkIntegrity(world)).toBe(true);
    expect(STAFF.poolSize).toBe(5);
  });
});
