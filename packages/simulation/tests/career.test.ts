import { CAREER, LOANS, MARKET_PRICES, STAFF, TECHNOLOGIES, instalment } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, canReceive, checkBuild, checkIntegrity, createWorld, machineUnlocked, modelUnlocked, orderableItems, payoff, step,
  techAvailable,
} from '../src';
import type { Command, World } from '../src';

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

function careerOf(world: World) {
  const career = world.progress.career;
  if (!career) throw new Error('pas une carrière');
  return career;
}

describe('carrière', () => {
  it('commence sans argent, sans spécialité ni machine de production', () => {
    const world = createWorld('career');
    expect(world.capitalCents).toBe(CAREER.initialCapitalCents);
    expect(careerOf(world)).toMatchObject({ specialty: null, technologies: [], loans: [] });
    expect(machineUnlocked(world, 'receiving')).toBe(true);
    expect(machineUnlocked(world, 'capacitor-press')).toBe(false);
    expect(machineUnlocked(world, 'headquarters')).toBe(false);
    expect(orderableItems(world.progress).size).toBe(0);
    expect(modelUnlocked(world.progress, 'office')).toBe(false);
    expect(checkBuild(world, { type: 'receiving', x: 10, y: 10, rotation: 0 })).toBe('insufficient-funds');
    expect(checkIntegrity(world)).toBe(true);
  });

  it('choisit une spécialité gratuite, une seule fois', () => {
    const world = run(createWorld('career'), { kind: 'choose-specialty', specialty: 'passives' });
    expect(careerOf(world).technologies).toEqual(['passives']);
    expect(machineUnlocked(world, 'capacitor-press')).toBe(true);
    expect([...orderableItems(world.progress)].sort()).toEqual(['ceramic-powder', 'copper-foil']);
    expect(applyCommand(world, { kind: 'choose-specialty', specialty: 'pcb' })).toEqual({ ok: false, reason: 'specialty-chosen' });
    expect(applyCommand(createWorld(), { kind: 'choose-specialty', specialty: 'pcb' })).toEqual({ ok: false, reason: 'not-career' });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('emprunte, paie les mensualités et rembourse par anticipation', () => {
    let world = run(run(createWorld('career'), { kind: 'choose-specialty', specialty: 'pcb' }), { kind: 'take-loan', offer: 'starter' });
    expect(world.capitalCents).toBe(LOANS.starter.principalCents);
    expect(applyCommand(world, { kind: 'take-loan', offer: 'starter' })).toEqual({ ok: false, reason: 'loan-unavailable' });
    world = ticks(world, STAFF.payPeriodTicks);
    const due = instalment(LOANS.starter);
    expect(world.capitalCents).toBe(LOANS.starter.principalCents - due);
    expect(careerOf(world).loans).toEqual([{ offer: 'starter', remaining: LOANS.starter.months - 1 }]);
    expect(checkIntegrity(world)).toBe(true);
    const loan = careerOf(world).loans[0];
    if (!loan) throw new Error('prêt absent');
    // Early repayment costs the principal still due, more than what is left of the first loan.
    expect(applyCommand(world, { kind: 'repay-loan', offer: 'starter' })).toEqual({ ok: false, reason: 'insufficient-funds' });
    world = run(world, { kind: 'take-loan', offer: 'growth' });
    const repaid = run(world, { kind: 'repay-loan', offer: 'starter' });
    expect(repaid.capitalCents).toBe(world.capitalCents - payoff(loan));
    expect(careerOf(repaid).loans).toEqual([{ offer: 'growth', remaining: LOANS.growth.months }]);
    expect(checkIntegrity(repaid)).toBe(true);
  });

  it('fait faillite après trois mensualités impayées et fige la partie', () => {
    let world = run(createWorld('career'), { kind: 'take-loan', offer: 'growth' });
    world = { ...world, capitalCents: 0, progress: { ...world.progress, career: { ...careerOf(world), borrowedCents: 0 } } };
    world = ticks(world, STAFF.payPeriodTicks * 2);
    expect(careerOf(world)).toMatchObject({ missed: 2, bankrupt: false });
    world = ticks(world, STAFF.payPeriodTicks);
    expect(careerOf(world)).toMatchObject({ missed: 3, bankrupt: true });
    expect(step(world)).toBe(world);
    expect(applyCommand(world, { kind: 'take-loan', offer: 'starter' })).toEqual({ ok: false, reason: 'bankrupt' });
  });

  it('vend les composants au grossiste par le quai d’expédition', () => {
    let world = run(createWorld('career'), { kind: 'choose-specialty', specialty: 'passives' });
    world = run(world, { kind: 'take-loan', offer: 'starter' });
    world = ([
      { kind: 'build', type: 'storage', x: 10, y: 12, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 10, y: 11, rotation: 0 },
      { kind: 'build', type: 'shipping', x: 10, y: 9, rotation: 0 },
    ] satisfies Command[]).reduce(run, world);
    expect(canReceive(world, 3, 'capacitor-reel')).toBe(true);
    expect(canReceive(world, 3, 'ceramic-powder')).toBe(false);
    world = { ...world, stocks: { 1: { 'capacitor-reel': 3 } }, ledger: { ...world.ledger, produced: { 'capacitor-reel': 3 } } };
    const before = world.capitalCents;
    world = ticks(world, 200);
    expect(world.capitalCents).toBe(before + 3 * (MARKET_PRICES['capacitor-reel'] ?? 0));
    expect(careerOf(world).marketShipped).toEqual({ 'capacitor-reel': 3 });
    expect(checkIntegrity(world)).toBe(true);
  });

  it('achète les licences dans l’ordre : branches, assemblage de cartes, ordinateurs', () => {
    let world = run(createWorld('career'), { kind: 'choose-specialty', specialty: 'power' });
    world = run(run(world, { kind: 'take-loan', offer: 'expansion' }), { kind: 'take-loan', offer: 'growth' });
    expect(techAvailable(careerOf(world), 'smt')).toBe(false);
    expect(applyCommand(world, { kind: 'buy-tech', tech: 'computers' })).toEqual({ ok: false, reason: 'tech-unavailable' });
    world = run(world, { kind: 'buy-tech', tech: 'passives' });
    world = run(world, { kind: 'buy-tech', tech: 'smt' });
    expect(machineUnlocked(world, 'smt-line')).toBe(true);
    expect(orderableItems(world.progress).has('bare-pcb')).toBe(true);
    world = run(world, { kind: 'buy-tech', tech: 'computers' });
    expect(machineUnlocked(world, 'assembler')).toBe(true);
    expect(modelUnlocked(world.progress, 'office')).toBe(true);
    const spent = TECHNOLOGIES.passives.costCents + TECHNOLOGIES.smt.costCents + TECHNOLOGIES.computers.costCents;
    expect(world.capitalCents).toBe(LOANS.expansion.principalCents + LOANS.growth.principalCents - spent);
    expect(checkIntegrity(world)).toBe(true);
    const forged = { ...careerOf(world), technologies: ['power', 'computers', 'passives', 'smt'] as const };
    expect(checkIntegrity({ ...world, progress: { ...world.progress, career: { ...forged, technologies: [...forged.technologies] } } })).toBe(false);
  });

  it('alimente la presse en proportions depuis un seul quai sans bloquer le convoyeur', () => {
    let world = run(run(createWorld('career'), { kind: 'choose-specialty', specialty: 'passives' }), { kind: 'take-loan', offer: 'starter' });
    world = ([
      { kind: 'build', type: 'receiving', x: 30, y: 36, rotation: 0 },
      { kind: 'build', type: 'capacitor-press', x: 31, y: 33, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 31, y: 35, rotation: 0 },
      { kind: 'build', type: 'conveyor', x: 32, y: 32, rotation: 0 },
      { kind: 'build', type: 'shipping', x: 32, y: 30, rotation: 0 },
      { kind: 'purchase', id: 1, lines: [{ item: 'ceramic-powder', supplier: 'express', lots: 2 }, { item: 'copper-foil', supplier: 'express', lots: 1 }] },
    ] satisfies Command[]).reduce(run, world);
    const before = world.capitalCents;
    world = ticks(world, 20 * 60 * 3);
    // Ten reels use all the ceramic and copper: none is left stuck on the belt.
    expect(careerOf(world).marketShipped).toEqual({ 'capacitor-reel': 10 });
    expect(world.capitalCents).toBe(before + 10 * (MARKET_PRICES['capacitor-reel'] ?? 0));
    expect(checkIntegrity(world)).toBe(true);
  });
});
