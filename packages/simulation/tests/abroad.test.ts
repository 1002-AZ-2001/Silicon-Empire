import { ABROAD, CALENDAR, MARKET_PRICES, PRODUCT_LINES, REGIONS, TECHNOLOGIES, ticksUntilYear } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, createWorld, freightCost, homePrice, localPrice, monthlyCost, overhead, step, transitTicks, unitCost,
} from '../src';
import type { CareerState, Command, World } from '../src';
import type { StartYear, TechId } from '@silicon-empire/game-data';

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

/** A career with the given licences, paid with borrowed money, and `capitalCents` left. */
function licensed(technologies: TechId[], capitalCents = 50_000_000, startYear: StartYear = 2017): World {
  const world = createWorld('career', { startYear });
  const spent = technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
  const career = { ...careerOf(world), specialty: 'passives' as const, technologies, borrowedCents: capitalCents + spent };
  return { ...world, capitalCents, progress: { ...world.progress, career } };
}

const GLOBAL: TechId[] = ['passives', 'pcb', 'smt', 'global'];
const MODERN = { era: 'modern' as const, behind: 0 };

describe('usines à l’étranger', () => {
  it('s’achètent avec la licence, une par région ouverte', () => {
    expect(applyCommand(createWorld('progression'), { kind: 'buy-factory', region: 'china' })).toEqual({ ok: false, reason: 'not-career' });
    expect(applyCommand(licensed(['passives', 'pcb', 'smt']), { kind: 'buy-factory', region: 'china' }))
      .toEqual({ ok: false, reason: 'region-unavailable' });
    const world = licensed(GLOBAL);
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, { kind: 'buy-factory', region: 'western-europe' })).toEqual({ ok: false, reason: 'region-unavailable' });
    const bought = run(world, { kind: 'buy-factory', region: 'china' });
    expect(bought.capitalCents).toBe(world.capitalCents - REGIONS.china.factoryCostCents);
    expect(careerOf(bought).abroad.subsidiaries).toEqual([{
      region: 'china', product: null, destination: 'local', mode: 'surface', dockId: null, nextRun: CALENDAR.monthTicks, idle: false,
    }]);
    expect(applyCommand(bought, { kind: 'buy-factory', region: 'china' })).toEqual({ ok: false, reason: 'region-unavailable' });
    expect(checkIntegrity(bought)).toBe(true);
    expect(applyCommand(licensed(GLOBAL, 100), { kind: 'buy-factory', region: 'india' })).toEqual({ ok: false, reason: 'insufficient-funds' });
  });

  it('ouvre les régions avec l’histoire : Chine en 1980, Europe de l’Est en 1990, Inde en 1991', () => {
    const world = licensed(GLOBAL, 50_000_000, 1975);
    for (const region of ['china', 'eastern-europe', 'india'] as const) {
      expect(applyCommand(world, { kind: 'buy-factory', region })).toEqual({ ok: false, reason: 'region-unavailable' });
    }
    expect(applyCommand(world, { kind: 'buy-factory', region: 'mexico' }).ok).toBe(true);
    const career = careerOf(world);
    const later = {
      ...world, tick: ticksUntilYear(1975, 1980),
      staff: { ...world.staff, nextPayday: world.staff.nextPayday + ticksUntilYear(1975, 1980), nextPool: world.staff.nextPool + ticksUntilYear(1975, 1980) },
      utilities: { ...world.utilities, nextBill: world.utilities.nextBill + ticksUntilYear(1975, 1980) },
      progress: { ...world.progress, career: { ...career, nextInstalment: career.nextInstalment + ticksUntilYear(1975, 1980) } },
    };
    expect(applyCommand(step(later), { kind: 'buy-factory', region: 'china' }).ok).toBe(true);
  });

  it('vend sa production sur le marché local à la fin du mois', () => {
    let world = run(licensed(GLOBAL), { kind: 'buy-factory', region: 'china' });
    world = run(world, { kind: 'set-subsidiary', region: 'china', product: 'capacitor-reel', destination: 'local', mode: 'surface', dockId: null });
    const before = world.capitalCents;
    world = ticks(world, CALENDAR.monthTicks);
    const units = PRODUCT_LINES['capacitor-reel'].unitsPerMonth;
    const cost = overhead('china') + units * unitCost('china', 'capacitor-reel', MODERN);
    const revenue = units * localPrice('china', 'capacitor-reel', MODERN);
    expect(localPrice('china', 'capacitor-reel', MODERN)).toBe(Math.floor((MARKET_PRICES['capacitor-reel'] ?? 0) * REGIONS.china.marketPercent / 100));
    expect(world.capitalCents).toBe(before - cost + revenue);
    expect(careerOf(world).abroad).toMatchObject({ revenueCents: revenue, spentCents: REGIONS.china.factoryCostCents + cost });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('expédie par bateau ou par avion avec les délais de la région', () => {
    let world = run(licensed(GLOBAL), { kind: 'buy-factory', region: 'china' });
    world = run(world, { kind: 'set-subsidiary', region: 'china', product: 'transformer', destination: 'export', mode: 'surface', dockId: null });
    world = ticks(world, CALENDAR.monthTicks);
    // Stop production after the first month: only the overhead is paid while the ship sails.
    world = run(world, { kind: 'set-subsidiary', region: 'china', product: null, destination: 'local', mode: 'surface', dockId: null });
    const [shipment] = careerOf(world).abroad.shipments;
    expect(shipment).toMatchObject({ item: 'transformer', units: 80, destination: 'export', dueTick: CALENDAR.monthTicks + 34 * ABROAD.dayTicks });
    expect(transitTicks('china', 'surface')).toBe(34 * ABROAD.dayTicks);
    expect(transitTicks('china', 'air')).toBe(3 * ABROAD.dayTicks);
    expect(monthlyCost({ region: 'china', product: 'transformer', destination: 'export', mode: 'surface' }, MODERN))
      .toBe(overhead('china') + 80 * unitCost('china', 'transformer', MODERN) + freightCost('china', 'transformer', 'surface', 80));
    const before = world.capitalCents;
    world = ticks(world, 34 * ABROAD.dayTicks);
    expect(careerOf(world).abroad.shipments).toEqual([]);
    expect(world.capitalCents).toBe(before + 80 * homePrice('transformer', MODERN) - overhead('china'));
    expect(checkIntegrity(world)).toBe(true);
  });

  it('livre un quai de réception et attend qu’il ait de la place', () => {
    let world = run(licensed(GLOBAL), { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 });
    const dock = world.machines[0];
    if (!dock) throw new Error('quai absent');
    world = run(world, { kind: 'purchase', id: dock.id, lines: [{ item: 'copper-foil', supplier: 'express', lots: 1 }] });
    world = run(world, { kind: 'buy-factory', region: 'eastern-europe' });
    world = run(world, { kind: 'set-subsidiary', region: 'eastern-europe', product: 'bare-pcb', destination: 'dock', mode: 'air', dockId: dock.id });
    expect(applyCommand(world, { kind: 'set-subsidiary', region: 'eastern-europe', product: 'bare-pcb', destination: 'dock', mode: 'air', dockId: null }))
      .toEqual({ ok: false, reason: 'subsidiary-invalid' });
    world = ticks(world, CALENDAR.monthTicks + ABROAD.dayTicks);
    // 100 units do not fit in the 90 places left: the shipment waits.
    expect(careerOf(world).abroad.shipments).toHaveLength(1);
    expect(world.stocks[dock.id]).toEqual({ 'copper-foil': 10 });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('remplit un quai assez grand et compte les unités importées', () => {
    let world = run(licensed(GLOBAL), { kind: 'build', type: 'receiving', x: 10, y: 10, rotation: 0 });
    const dock = world.machines[0];
    if (!dock) throw new Error('quai absent');
    world = run(world, { kind: 'buy-factory', region: 'eastern-europe' });
    world = run(world, { kind: 'set-subsidiary', region: 'eastern-europe', product: 'circuit-board', destination: 'dock', mode: 'surface', dockId: dock.id });
    world = ticks(world, CALENDAR.monthTicks + 3 * ABROAD.dayTicks);
    expect(world.stocks[dock.id]).toEqual({ 'circuit-board': 40 });
    expect(careerOf(world).abroad.imported).toEqual({ 'circuit-board': 40 });
    expect(checkIntegrity(world)).toBe(true);
    expect(checkIntegrity({ ...world, stocks: { ...world.stocks, [dock.id]: { 'circuit-board': 41 } } })).toBe(false);
  });

  it('reste à l’arrêt un mois impayé et réserve les PC à la licence ordinateurs', () => {
    let world = run(licensed(GLOBAL, REGIONS.india.factoryCostCents), { kind: 'buy-factory', region: 'india' });
    expect(applyCommand(world, { kind: 'set-subsidiary', region: 'india', product: 'pc-office-packaged', destination: 'local', mode: 'surface', dockId: null }))
      .toEqual({ ok: false, reason: 'locked' });
    world = run(world, { kind: 'set-subsidiary', region: 'india', product: 'circuit-board', destination: 'local', mode: 'surface', dockId: null });
    world = ticks(world, CALENDAR.monthTicks);
    expect(world.capitalCents).toBe(0);
    expect(careerOf(world).abroad.subsidiaries[0]).toMatchObject({ idle: true, nextRun: 2 * CALENDAR.monthTicks });
    expect(checkIntegrity(world)).toBe(true);
  });
});
