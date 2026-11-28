import { CALENDAR, ERAS, TECHNOLOGIES, dateAt, eraOfYear, obsolescence, recipeOf, saleOffer, ticksUntilYear } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  applyCommand, checkIntegrity, contractPrice, createWorld, eraOf, erasBehind, modelUnlocked, orderableItems, retoolCost, step,
  validSaleTerms,
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

/** Moves every calendar of a fresh workshop to `tick`, as if the time had passed with nothing to do. */
function at(world: World, tick: number): World {
  const shift = tick - world.tick;
  const career = careerOf(world);
  return {
    ...world,
    tick,
    staff: { ...world.staff, nextPayday: world.staff.nextPayday + shift, nextPool: world.staff.nextPool + shift },
    utilities: { ...world.utilities, nextBill: world.utilities.nextBill + shift },
    progress: {
      ...world.progress,
      career: {
        ...career, nextInstalment: career.nextInstalment + shift,
        // Months always start on a multiple of the month length.
        competition: { ...career.competition, nextMonth: (Math.floor(tick / CALENDAR.monthTicks) + 1) * CALENDAR.monthTicks },
      },
    },
  };
}

/** A career with the computers licence, paid with borrowed money, and `capitalCents` left. */
function withComputers(startYear: StartYear, capitalCents = 20_000_000): World {
  const world = createWorld('career', { startYear });
  const technologies: TechId[] = ['passives', 'pcb', 'smt', 'computers'];
  const spent = technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
  const career = { ...careerOf(world), specialty: 'passives' as const, technologies, borrowedCents: capitalCents + spent };
  return { ...world, capitalCents, progress: { ...world.progress, career } };
}

describe('calendrier', () => {
  it('date un mois par période de paie à partir du 1er janvier', () => {
    expect(dateAt(1975, 0)).toEqual({ year: 1975, month: 0 });
    expect(dateAt(1975, CALENDAR.monthTicks * 13 + 5)).toEqual({ year: 1976, month: 1 });
    expect(ticksUntilYear(1975, 1983)).toBe(8 * 12 * CALENDAR.monthTicks);
    expect(eraOfYear(1975)).toBe('8bit');
    expect(eraOfYear(1985)).toBe('16bit');
    expect(eraOfYear(1995)).toBe('32bit');
    expect(eraOfYear(2005)).toBe('64bit');
    expect(eraOfYear(2030)).toBe('modern');
  });

  it('démarre une carrière à l’année choisie, dans l’époque de cette année', () => {
    for (const [year, era] of [[1975, '8bit'], [1985, '16bit'], [1995, '32bit'], [2005, '64bit'], [2017, 'modern']] as const) {
      const world = createWorld('career', { startYear: year });
      expect(careerOf(world)).toMatchObject({ startYear: year, released: era, era, retoolCents: 0 });
      expect(checkIntegrity(world)).toBe(true);
    }
    expect(careerOf(createWorld('career')).startYear).toBe(2017);
    expect(eraOf(createWorld('progression').progress)).toBe('modern');
  });

  it('suit la nouvelle époque gratuitement tant qu’aucune chaîne de PC n’existe', () => {
    let world = at(createWorld('career', { startYear: 1975 }), ticksUntilYear(1975, 1983) - 1);
    expect(checkIntegrity(world)).toBe(true);
    world = step(world);
    expect(careerOf(world)).toMatchObject({ released: '16bit', era: '16bit', retoolCents: 0 });
    expect(checkIntegrity(world)).toBe(true);
  });
});

describe('époques', () => {
  it('vend les pièces de l’époque et les modèles qu’elle sait assembler', () => {
    const world = withComputers(1975);
    expect(checkIntegrity(world)).toBe(true);
    const orderable = orderableItems(world.progress);
    for (const part of ['cpu-8bit', 'ram-4k', 'floppy-8in', 'board-s100', 'psu-linear', 'case-desk', 'carton'] as const) {
      expect(orderable.has(part)).toBe(true);
    }
    expect(orderable.has('cpu-8c')).toBe(false);
    expect(orderable.has('cpu-16bit')).toBe(false);
    expect(modelUnlocked(world.progress, 'office')).toBe(true);
    expect(modelUnlocked(world.progress, 'gaming')).toBe(false);
    expect(recipeOf('assembler', 'office', null, '8bit')?.inputs).toEqual({
      'cpu-8bit': 1, 'ram-4k': 1, 'floppy-8in': 1, 'board-s100': 1, 'psu-linear': 1, 'case-desk': 1,
    });
    expect(recipeOf('assembler', 'gaming', null, '8bit')).toBeUndefined();
    expect(recipeOf('tester', 'office', null, '8bit')).toEqual(recipeOf('tester', 'office'));
  });

  it('ne vend que les pièces des époques depuis l’année de départ', () => {
    expect(orderableItems(withComputers(1985).progress).has('cpu-8bit')).toBe(false);
    expect(orderableItems(withComputers(1985).progress).has('psu-linear')).toBe(true);
    const modern = orderableItems(withComputers(2017).progress);
    expect(modern.has('cpu-64bit')).toBe(false);
    expect((['cpu-8c', 'gpu-8g', 'ram-32g', 'ssd-2t', 'psu-650', 'carton'] as const).every(item => modern.has(item))).toBe(true);
  });

  it('n’offre jamais les pièces historiques hors carrière', () => {
    for (const world of [createWorld('sandbox'), createWorld('progression')]) {
      expect(orderableItems(world.progress).has('cpu-8bit')).toBe(false);
    }
    expect(orderableItems(createWorld('sandbox').progress).has('cpu-8c')).toBe(true);
  });

  it('annonce la génération suivante et baisse le prix des PC dépassés', () => {
    let world = at(withComputers(1975), ticksUntilYear(1975, 1983) - 1);
    world = step(world);
    const career = careerOf(world);
    expect(career).toMatchObject({ released: '16bit', era: '8bit' });
    expect(erasBehind(career)).toBe(1);
    expect(orderableItems(world.progress).has('cpu-16bit')).toBe(true);
    expect(orderableItems(world.progress).has('cpu-8bit')).toBe(true);
    const index = career.competition.prices.office;
    expect(contractPrice(world, 65_000)).toBe(Math.ceil(65_000 * obsolescence(1) * index / 10_000));
    world = run(run(world, { kind: 'build', type: 'shipping', x: 20, y: 20, rotation: 0 }), { kind: 'start-sale', model: 'office' });
    const terms = world.sales.active?.terms;
    expect(terms).toMatchObject({
      era: '8bit', unitPriceCents: Math.ceil(65_000 * obsolescence(1) * index / 10_000), unitMaterialCents: saleOffer('office', null, '8bit')?.unitMaterialCents,
    });
    expect(terms && validSaleTerms(terms)).toBe(true);
    expect(checkIntegrity(world)).toBe(true);
  });

  it('adopte une époque en payant chaque licence de rééquipement jusqu’à elle', () => {
    let world = at(withComputers(1975), ticksUntilYear(1975, 1986));
    world = step(world);
    expect(careerOf(world).released).toBe('32bit');
    expect(retoolCost(careerOf(world), '32bit')).toBe(ERAS['16bit'].costCents + ERAS['32bit'].costCents);
    expect(applyCommand(world, { kind: 'adopt-era', era: '3d' })).toEqual({ ok: false, reason: 'era-unavailable' });
    expect(applyCommand(world, { kind: 'adopt-era', era: '8bit' })).toEqual({ ok: false, reason: 'era-unavailable' });
    const before = world.capitalCents;
    world = run(world, { kind: 'adopt-era', era: '32bit' });
    expect(world.capitalCents).toBe(before - ERAS['16bit'].costCents - ERAS['32bit'].costCents);
    expect(careerOf(world)).toMatchObject({ era: '32bit', retoolCents: ERAS['16bit'].costCents + ERAS['32bit'].costCents });
    expect(eraOf(world.progress)).toBe('32bit');
    expect(checkIntegrity(world)).toBe(true);
    expect(applyCommand(world, { kind: 'adopt-era', era: '16bit' })).toEqual({ ok: false, reason: 'era-unavailable' });
  });

  it('refuse le rééquipement si un assembleur garde des pièces de l’ancienne époque', () => {
    let world = at(withComputers(1975), ticksUntilYear(1975, 1983));
    world = step(world);
    world = run(world, { kind: 'build', type: 'assembler', x: 20, y: 20, rotation: 0 });
    const assembler = world.machines.find(machine => machine.type === 'assembler');
    if (!assembler) throw new Error('assembleur absent');
    const stocked = { ...world, stocks: { ...world.stocks, [assembler.id]: { 'cpu-8bit': 1 } } };
    expect(applyCommand(stocked, { kind: 'adopt-era', era: '16bit' })).toEqual({ ok: false, reason: 'incompatible-inputs' });
    expect(applyCommand(world, { kind: 'adopt-era', era: '16bit' }).ok).toBe(true);
  });

  it('refuse le rééquipement sans la licence ordinateurs ou sans fonds', () => {
    const plain = step(at(createWorld('career', { startYear: 1975 }), ticksUntilYear(1975, 1983)));
    expect(applyCommand(plain, { kind: 'adopt-era', era: '16bit' })).toEqual({ ok: false, reason: 'era-unavailable' });
    const poor = step(at(withComputers(1975, 100), ticksUntilYear(1975, 1983)));
    expect(applyCommand(poor, { kind: 'adopt-era', era: '16bit' })).toEqual({ ok: false, reason: 'insufficient-funds' });
    expect(applyCommand(createWorld('progression'), { kind: 'adopt-era', era: 'modern' })).toEqual({ ok: false, reason: 'not-career' });
  });

  it('ouvre le gaming en 1997 et les stations de travail en 2005', () => {
    const gaming = withComputers(1995);
    expect(modelUnlocked(gaming.progress, 'gaming')).toBe(false);
    const workstation = withComputers(2005);
    expect(modelUnlocked(workstation.progress, 'gaming')).toBe(true);
    expect(modelUnlocked(workstation.progress, 'professional')).toBe(true);
    expect(modelUnlocked(workstation.progress, 'custom')).toBe(false);
    expect(recipeOf('assembler', 'professional', null, '64bit')?.inputs).toMatchObject({ 'ram-1g': 2, 'hdd-250g': 2, 'psu-650': 1 });
    expect(orderableItems(workstation.progress).has('psu-650')).toBe(true);
  });

  it('rejette une date ou une époque incohérente', () => {
    const world = withComputers(1975);
    const career = careerOf(world);
    const broken = (patch: Partial<CareerState>) => checkIntegrity({ ...world, progress: { ...world.progress, career: { ...career, ...patch } } });
    expect(broken({ released: '16bit' })).toBe(false);
    expect(broken({ era: '16bit' })).toBe(false);
    expect(broken({ retoolCents: -1 })).toBe(false);
    expect(broken({ startYear: 1990 as StartYear })).toBe(false);
    const fresh = createWorld('career', { startYear: 1985 });
    const early = careerOf(fresh);
    expect(checkIntegrity({ ...fresh, progress: { ...fresh.progress, career: { ...early, released: '8bit', era: '8bit' } } })).toBe(false);
  });

  it('chaque PC de bureau historique coûte autant de pièces qu’un PC moderne, à 3 % près', () => {
    const modern = saleOffer('office').unitMaterialCents;
    for (const era of ['8bit', '16bit', '32bit', '3d', '64bit'] as const) {
      const material = saleOffer('office', null, era)?.unitMaterialCents ?? 0;
      expect(Math.abs(material - modern) / modern).toBeLessThan(0.03);
    }
  });
});
