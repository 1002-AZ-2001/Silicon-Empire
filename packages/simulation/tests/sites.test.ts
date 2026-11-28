import { ITEMS, MACHINES, MARKET_PRICES, PURCHASE, REGIONS, TECHNOLOGIES } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import { applyCommand, checkIntegrity, createWorld, siteOf, siteView, step } from '../src';
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

/** A career with a factory in China, its land empty, and `capitalCents` left. */
function withChina(capitalCents = 30_000_000): World {
  const world = createWorld('career');
  const technologies: TechId[] = ['passives', 'pcb', 'smt', 'global'];
  const spent = technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
  const career = { ...careerOf(world), specialty: 'passives' as const, technologies, borrowedCents: capitalCents + spent + REGIONS.china.factoryCostCents };
  const funded = { ...world, capitalCents: capitalCents + REGIONS.china.factoryCostCents, progress: { ...world.progress, career } };
  return run(funded, { kind: 'buy-factory', region: 'china' });
}

const atChina = (command: Extract<Command, { kind: 'at-site' }>['command']): Command => ({ kind: 'at-site', region: 'china', command });

describe('usines constructibles', () => {
  it('donne un terrain vide à chaque usine achetée', () => {
    const world = withChina();
    expect(world.sites).toHaveLength(1);
    expect(siteOf(world, 'china')).toMatchObject({ machines: [], parcels: [0, 1, 4, 5] });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('construit sur le site avec le capital de l’entreprise et des identifiants uniques', () => {
    let world = withChina();
    world = run(world, { kind: 'build', type: 'storage', x: 10, y: 10, rotation: 0 });
    const before = world.capitalCents;
    world = run(world, atChina({ kind: 'build', type: 'capacitor-press', x: 10, y: 10, rotation: 0 }));
    expect(world.capitalCents).toBe(before - MACHINES['capacitor-press'].costCents);
    expect(world.machines.map(machine => machine.type)).toEqual(['storage']);
    expect(siteOf(world, 'china')?.machines).toEqual([expect.objectContaining({ id: 2, type: 'capacitor-press', x: 10, y: 10 })]);
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, atChina({ kind: 'build', type: 'lab', x: 30, y: 30, rotation: 0 }))).toEqual({ ok: false, reason: 'locked' });
    expect(applyCommand(world, { kind: 'at-site', region: 'india', command: { kind: 'rotate', id: 2 } })).toEqual({ ok: false, reason: 'region-unavailable' });
    expect(applyCommand(world, atChina({ kind: 'demolish', id: 1 }))).toEqual({ ok: false, reason: 'missing-machine' });
  });

  it('achète les matières au prix local du site', () => {
    let world = run(withChina(), atChina({ kind: 'build', type: 'receiving', x: 20, y: 20, rotation: 0 }));
    const dock = siteOf(world, 'china')?.machines[0];
    if (!dock) throw new Error('quai absent');
    const before = world.capitalCents;
    world = run(world, atChina({ kind: 'purchase', id: dock.id, lines: [{ item: 'copper-foil', supplier: 'express', lots: 1 }] }));
    const home = (ITEMS['copper-foil'].unitCostCents ?? 0) * PURCHASE.lotSize;
    expect(before - world.capitalCents).toBe(Math.floor(home * REGIONS.china.materialPercent / 100));
    expect(siteOf(world, 'china')?.stocks[dock.id]).toEqual({ 'copper-foil': 10 });
    expect(world.stocks).toEqual({});
    expect(checkIntegrity(world)).toBe(true);
  });

  it('fait tourner la chaîne du site et vend au grossiste local', () => {
    let world = withChina();
    // Dock, one conveyor north, then the shipping dock: the layout of the career tests.
    world = run(world, atChina({ kind: 'build', type: 'receiving', x: 30, y: 36, rotation: 0 }));
    world = run(world, atChina({ kind: 'build', type: 'conveyor', x: 31, y: 35, rotation: 0 }));
    world = run(world, atChina({ kind: 'build', type: 'shipping', x: 31, y: 33, rotation: 0 }));
    const [dock] = siteOf(world, 'china')?.machines ?? [];
    if (!dock) throw new Error('quai absent');
    world = run(world, atChina({ kind: 'purchase', id: dock.id, lines: [{ item: 'capacitor-reel', supplier: 'express', lots: 1 }] }));
    const before = world.capitalCents;
    const revenue = careerOf(world).marketRevenueCents;
    world = ticks(world, 400);
    const sold = careerOf(world).marketShipped['capacitor-reel'] ?? 0;
    expect(sold).toBeGreaterThan(0);
    const local = Math.floor((MARKET_PRICES['capacitor-reel'] ?? 0) * REGIONS.china.marketPercent / 100);
    expect(careerOf(world).marketRevenueCents - revenue).toBe(sold * local);
    expect(world.capitalCents).toBeGreaterThan(before);
    expect(careerOf(world).competition.sold).toEqual({});
    expect(checkIntegrity(world)).toBe(true);
  });

  it('rejette un site sans usine, un bâtiment du siège à l’étranger ou des identifiants en double', () => {
    const world = run(withChina(), atChina({ kind: 'build', type: 'storage', x: 10, y: 10, rotation: 0 }));
    expect(checkIntegrity({ ...world, sites: [] })).toBe(false);
    const site = siteOf(world, 'china');
    if (!site) throw new Error('site absent');
    expect(checkIntegrity({ ...world, sites: [{ ...site, region: 'india' }] })).toBe(false);
    const lab = { ...site, machines: [{ id: 1, type: 'lab' as const, x: 10, y: 10, rotation: 0 as const, paidCents: MACHINES.lab.costCents }] };
    expect(checkIntegrity({ ...world, sites: [lab] })).toBe(false);
    const twice = run(world, { kind: 'build', type: 'storage', x: 30, y: 30, rotation: 0 });
    const clash = { ...twice, machines: twice.machines.map(machine => ({ ...machine, id: 1 })) };
    expect(checkIntegrity(clash)).toBe(false);
    expect(checkIntegrity({ ...siteView(world, 'china') })).toBe(false);
  });
});
