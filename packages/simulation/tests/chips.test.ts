import { ITEMS, MARKET_PRICES, TECHNOLOGIES, recipeOf, saleOffer, withHouseChips } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, chipsOf, createWorld, machineUnlocked, orderableItems, sellToMarket, validSaleTerms,
} from '../src';
import type { CareerState, Command, World } from '../src';
import type { StartYear, TechId } from '@silicon-empire/game-data';

function run(world: World, command: Command): World {
  const result = applyCommand(world, command);
  if (!result.ok) throw new Error(result.reason);
  return result.world;
}

function careerOf(world: World): CareerState {
  const career = world.progress.career;
  if (!career) throw new Error('pas une carrière');
  return career;
}

function licensed(technologies: TechId[], startYear: StartYear = 2017, capitalCents = 20_000_000): World {
  const world = createWorld('career', { startYear });
  const spent = technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
  const career = { ...careerOf(world), specialty: 'passives' as const, technologies, borrowedCents: capitalCents + spent };
  return { ...world, capitalCents, progress: { ...world.progress, career } };
}

const FULL: TechId[] = ['passives', 'pcb', 'smt', 'computers', 'semiconductors'];

describe('puces maison', () => {
  it('ouvre les fonderies, les wafers, les substrats et les puces avec la licence', () => {
    const before = licensed(['passives', 'pcb', 'smt']);
    expect(machineUnlocked(before, 'cpu-fab')).toBe(false);
    const world = licensed(['passives', 'pcb', 'smt', 'semiconductors']);
    for (const fab of ['ram-fab', 'cpu-fab', 'gpu-fab'] as const) expect(machineUnlocked(world, fab)).toBe(true);
    const orderable = orderableItems(world.progress);
    for (const item of ['silicon-wafer', 'chip-substrate', 'chip-ram', 'chip-cpu', 'chip-gpu'] as const) expect(orderable.has(item)).toBe(true);
    expect(recipeOf('cpu-fab')).toEqual({ inputs: { 'silicon-wafer': 2, 'chip-substrate': 1 }, output: 'chip-cpu', ticks: 600 });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('coûte moins cher à fabriquer qu’à acheter, et se vend au grossiste', () => {
    const material = (item: 'chip-ram' | 'chip-cpu' | 'chip-gpu') => Object.entries(recipeOf(item === 'chip-ram' ? 'ram-fab' : item === 'chip-cpu' ? 'cpu-fab' : 'gpu-fab')?.inputs ?? {})
      .reduce((total, [input, count]) => total + (ITEMS[input as keyof typeof ITEMS].unitCostCents ?? 0) * (count ?? 0), 0);
    for (const chip of ['chip-ram', 'chip-cpu', 'chip-gpu'] as const) {
      expect(material(chip)).toBeLessThan(MARKET_PRICES[chip] ?? 0);
      expect(MARKET_PRICES[chip] ?? 0).toBeLessThan(ITEMS[chip].unitCostCents ?? 0);
    }
    const career = careerOf(licensed(FULL));
    const sold = sellToMarket(career, 'chip-cpu');
    expect(sold.marketRevenueCents).toBe(MARKET_PRICES['chip-cpu']);
    expect(sold.competition.sold).toEqual({ 'chip-cpu': 1 });
  });

  it('remplace le processeur, la carte graphique et la mémoire achetés par les puces maison', () => {
    expect(withHouseChips({ 'cpu-8c': 1, 'ram-32g': 1, 'gpu-8g': 1, 'ssd-2t': 1 }, ['cpu', 'ram'])).toEqual({
      'chip-cpu': 1, 'chip-ram': 1, 'gpu-8g': 1, 'ssd-2t': 1,
    });
    expect(recipeOf('assembler', 'office', null, '8bit', ['cpu'])?.inputs).toMatchObject({ 'chip-cpu': 1, 'ram-4k': 1 });
    expect(recipeOf('assembler', 'professional', null, '64bit', ['ram'])?.inputs).toMatchObject({ 'chip-ram': 2 });
    expect(recipeOf('tester', 'office', null, 'modern', ['cpu'])).toEqual(recipeOf('tester', 'office'));
  });

  it('choisit les puces maison avec les deux licences et un établi compatible', () => {
    expect(applyCommand(licensed(['passives', 'pcb', 'smt', 'computers']), { kind: 'set-house-chips', chips: ['cpu'] }))
      .toEqual({ ok: false, reason: 'locked' });
    let world = licensed(FULL);
    expect(applyCommand(world, { kind: 'set-house-chips', chips: ['ram', 'cpu'] })).toEqual({ ok: false, reason: 'invalid-order' });
    world = run(world, { kind: 'build', type: 'assembler', x: 20, y: 20, rotation: 0 });
    const assembler = world.machines[0];
    if (!assembler) throw new Error('établi absent');
    const stocked = { ...world, stocks: { [assembler.id]: { 'cpu-8c': 1 } } };
    expect(applyCommand(stocked, { kind: 'set-house-chips', chips: ['cpu'] })).toEqual({ ok: false, reason: 'incompatible-inputs' });
    world = run(world, { kind: 'set-house-chips', chips: ['cpu', 'ram'] });
    expect(chipsOf(world.progress)).toEqual(['cpu', 'ram']);
    expect(checkIntegrity(world)).toBe(true);
    world = run(world, { kind: 'build', type: 'shipping', x: 30, y: 20, rotation: 0 });
    world = run(world, { kind: 'start-sale', model: 'office' });
    const terms = world.sales.active?.terms;
    expect(terms?.chips).toEqual(['cpu', 'ram']);
    expect(terms?.unitMaterialCents).toBe(saleOffer('office', null, 'modern', ['cpu', 'ram'])?.unitMaterialCents);
    expect(terms && validSaleTerms(terms)).toBe(true);
    expect(terms && validSaleTerms({ ...terms, chips: ['ram', 'cpu'] })).toBe(false);
    expect(checkIntegrity(world)).toBe(true);
    const forged = { ...world, progress: { ...world.progress, career: { ...careerOf(world), technologies: ['passives', 'pcb', 'smt', 'computers'] as TechId[] } } };
    expect(checkIntegrity(forged)).toBe(false);
  });
});
