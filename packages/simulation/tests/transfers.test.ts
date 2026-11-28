import { ABROAD, CALENDAR, REGIONS, STAFF, TECHNOLOGIES, TRANSFER } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, createWorld, monthlyPowerBill, regionalPayroll, siteOf, siteView, step, transferCost, transferTicks,
} from '../src';
import type { CareerState, Command, World } from '../src';
import type { TechId } from '@silicon-empire/game-data';

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

function careerOf(world: World): CareerState {
  const career = world.progress.career;
  if (!career) throw new Error('pas une carrière');
  return career;
}

/** A career with a factory in China and `capitalCents` left; `utilities` turns electricity on. */
function withChina(capitalCents = 30_000_000, utilities = false, extra: TechId[] = []): World {
  const world = createWorld('career', { utilities });
  const technologies: TechId[] = ['passives', 'pcb', 'smt', 'global', ...extra];
  const spent = technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
  const career = { ...careerOf(world), specialty: 'passives' as const, technologies, borrowedCents: capitalCents + spent + REGIONS.china.factoryCostCents };
  const funded = { ...world, capitalCents: capitalCents + REGIONS.china.factoryCostCents, progress: { ...world.progress, career } };
  return run(funded, { kind: 'buy-factory', region: 'china' });
}

const atChina = (command: Extract<Command, { kind: 'at-site' }>['command']): Command => ({ kind: 'at-site', region: 'china', command });

/** Home: dock, conveyor and a shipping dock routed to a dock in China. Ids: 1 home dock, 2 conveyor, 3 shipping, 4 China dock. */
function routed(mode: 'surface' | 'air' = 'air'): World {
  let world = withChina();
  world = run(world, { kind: 'build', type: 'receiving', x: 30, y: 36, rotation: 0 });
  world = run(world, { kind: 'build', type: 'conveyor', x: 31, y: 35, rotation: 0 });
  world = run(world, { kind: 'build', type: 'shipping', x: 31, y: 33, rotation: 0 });
  world = run(world, atChina({ kind: 'build', type: 'receiving', x: 20, y: 20, rotation: 0 }));
  return run(world, { kind: 'set-route', from: 'home', id: 3, route: { to: 'china', dockId: 4, mode } });
}

describe('transferts entre sites', () => {
  it('relie un quai d’expédition à un quai de réception d’un autre site', () => {
    const world = routed();
    expect(world.machines.find(machine => machine.id === 3)?.route).toEqual({ to: 'china', dockId: 4, mode: 'air' });
    expect(checkIntegrity(world)).toBe(true);
    const route = { to: 'china' as const, dockId: 4, mode: 'air' as const };
    expect(applyCommand(world, { kind: 'set-route', from: 'home', id: 1, route })).toEqual({ ok: false, reason: 'not-a-dock' });
    expect(applyCommand(world, { kind: 'set-route', from: 'home', id: 3, route: { ...route, to: 'home' } })).toEqual({ ok: false, reason: 'invalid-order' });
    expect(applyCommand(world, { kind: 'set-route', from: 'home', id: 3, route: { ...route, dockId: 1 } })).toEqual({ ok: false, reason: 'not-a-dock' });
    expect(applyCommand(world, { kind: 'set-route', from: 'home', id: 3, route: { ...route, to: 'india' } })).toEqual({ ok: false, reason: 'region-unavailable' });
    expect(run(world, { kind: 'set-route', from: 'home', id: 3, route: null }).machines.find(machine => machine.id === 3)?.route).toBeUndefined();
  });

  it('rassemble les unités, les envoie chaque jour par avion et les livre au quai du site', () => {
    let world = routed('air');
    world = run(world, { kind: 'purchase', id: 1, lines: [{ item: 'copper-foil', supplier: 'express', lots: 1 }] });
    world = ticks(world, TRANSFER.dispatchTicks - world.tick - 1);
    const gathered = world.stocks[3] ?? {};
    expect(gathered['copper-foil'] ?? 0).toBeGreaterThan(0);
    const before = world.capitalCents;
    world = step(world);
    const [transfer] = world.transfers.list;
    expect(transfer).toMatchObject({ item: 'copper-foil', from: 'home', to: 'china', dockId: 4, dueTick: TRANSFER.dispatchTicks + transferTicks('home', 'china', 'air') });
    const freight = transferCost('home', 'china', 'air', gathered);
    expect(before - world.capitalCents).toBe(freight);
    expect(world.transfers.spentCents).toBe(freight);
    expect(world.stocks[3]).toBeUndefined();
    expect(checkIntegrity(world)).toBe(true);
    world = ticks(world, 3 * ABROAD.dayTicks);
    expect(siteOf(world, 'china')?.stocks[4]?.['copper-foil'] ?? 0).toBeGreaterThan(0);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('perd la marchandise si le quai d’arrivée a été démoli en route', () => {
    let world = routed('surface');
    world = run(world, { kind: 'purchase', id: 1, lines: [{ item: 'copper-foil', supplier: 'express', lots: 1 }] });
    world = ticks(world, TRANSFER.dispatchTicks + 1);
    expect(world.transfers.list.length).toBeGreaterThan(0);
    world = run(world, atChina({ kind: 'demolish', id: 4 }));
    world = ticks(world, transferTicks('home', 'china', 'surface'));
    expect(world.transfers.list).toEqual([]);
    expect(world.ledger.discarded['copper-foil'] ?? 0).toBeGreaterThan(0);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('rejette un transfert ou une route incohérents', () => {
    let world = routed();
    world = run(world, { kind: 'purchase', id: 1, lines: [{ item: 'copper-foil', supplier: 'express', lots: 1 }] });
    world = ticks(world, TRANSFER.dispatchTicks + 1);
    const [transfer] = world.transfers.list;
    if (!transfer) throw new Error('transfert absent');
    const forge = (patch: Partial<typeof transfer>) => checkIntegrity({ ...world, transfers: { ...world.transfers, list: [{ ...transfer, ...patch }] } });
    expect(forge({ to: 'india' })).toBe(false);
    expect(forge({ units: transfer.units + 1 })).toBe(false);
    expect(forge({ dueTick: world.tick + 10 * CALENDAR.monthTicks })).toBe(false);
    expect(checkIntegrity({ ...world, machines: world.machines.map(machine => machine.id === 1 ? { ...machine, route: { to: 'china', dockId: 4, mode: 'air' } } : machine) })).toBe(false);
  });
});

describe('coûts régionaux', () => {
  it('paie un employé d’un site au salaire de la région', () => {
    // Operators run the PC lines: the assembly bench needs the computers licence.
    let world = run(withChina(30_000_000, false, ['computers']), atChina({ kind: 'build', type: 'assembler', x: 20, y: 20, rotation: 0 }));
    const press = siteOf(world, 'china')?.machines[0];
    const candidate = world.staff.candidates.find(person => person.role === 'operator');
    if (!press || !candidate) throw new Error('scénario incomplet');
    world = run(world, { kind: 'hire', candidate: candidate.id });
    const employee = world.staff.employees[0];
    if (!employee) throw new Error('employé absent');
    world = run(world, { kind: 'assign', employee: employee.id, machine: press.id });
    expect(regionalPayroll(world)).toBe(Math.ceil(employee.salaryCents * REGIONS.china.wagePercent / 100));
    expect(checkIntegrity(world)).toBe(true);
    const paid = ticks(world, STAFF.payPeriodTicks);
    expect(paid.staff.paidCents).toBe(regionalPayroll(world));
    expect(checkIntegrity(paid)).toBe(true);
  });

  it('facture l’électricité d’un site au prix de sa région', () => {
    let world = withChina(30_000_000, true);
    world = run(world, atChina({ kind: 'build', type: 'grid-connection', x: 20, y: 18, rotation: 0 }));
    world = run(world, atChina({ kind: 'build', type: 'capacitor-press', x: 20, y: 20, rotation: 0 }));
    world = run(world, atChina({ kind: 'lay-cable', tiles: [{ x: 20, y: 19 }, { x: 20, y: 20 }] }));
    const siteBill = monthlyPowerBill({ ...siteView(world, 'china'), utilities: { ...world.utilities, cut: false } });
    expect(siteBill).toBeGreaterThan(0);
    const homeBill = monthlyPowerBill({ ...world, utilities: { ...world.utilities, cut: false } });
    const billed = ticks(world, world.utilities.nextBill - world.tick);
    expect(billed.utilities.spentCents).toBe(homeBill + Math.ceil(siteBill * REGIONS.china.powerPercent / 100));
    expect(checkIntegrity(billed)).toBe(true);
  });
});
