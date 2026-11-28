import { CALENDAR, COMPETITION, MARKET_DEMAND, MARKET_IDS, MARKET_PRICES } from '@silicon-empire/game-data';
import { describe, expect, it } from 'vitest';
import {
  advanceCompetition, checkIntegrity, companyShare, createCompetition, createWorld, recordSale, rivalSupply, sellToMarket, supplyBounds,
  wholesalePrice,
} from '../src';
import type { CareerState, CompetitionState, World } from '../src';

function careerOf(world: World): CareerState {
  const career = world.progress.career;
  if (!career) throw new Error('pas une carrière');
  return career;
}

/** Runs `months` market months from a competition, the company selling `sold` units each month. */
function months(start: CompetitionState, count: number, sold: Partial<Record<(typeof MARKET_IDS)[number], number>> = {}): CompetitionState {
  let competition = start;
  for (let month = 0; month < count; month++) {
    for (const [market, units] of Object.entries(sold)) competition = recordSale(competition, market as (typeof MARKET_IDS)[number], units ?? 0);
    competition = advanceCompetition(competition, 2017, competition.nextMonth);
  }
  return competition;
}

describe('concurrence', () => {
  it('fait entrer les rivaux selon l’année de départ, aux prix de référence', () => {
    expect(createCompetition(1975).rivals.map(rival => rival.id)).toEqual(['helion', 'vortek']);
    expect(createCompetition(1995).rivals.map(rival => rival.id)).toEqual(['helion', 'vortek', 'norrland', 'kaori', 'xinhe']);
    const competition = createCompetition(1975);
    expect(MARKET_IDS.every(market => competition.prices[market] === 100)).toBe(true);
    expect(competition.nextMonth).toBe(CALENDAR.monthTicks);
    expect(rivalSupply(competition, 'capacitor-reel')).toBe(Math.round(MARKET_DEMAND['capacitor-reel'] * 30 / 100));
  });

  it('monte les prix d’un marché peu servi et les baisse quand l’offre déborde', () => {
    const start = createCompetition(1975);
    const scarce = advanceCompetition(start, 1975, start.nextMonth);
    // 90 condensateurs pour 300 demandés : l’indice monte de la moitié de l’écart.
    expect(scarce.prices['capacitor-reel']).toBe(Math.round((100 + 100 + COMPETITION.elasticity * (300 - 90) / 300) / 2));
    // Aucun rival sur les cartes électroniques en 1975 : l’indice va vers le plafond.
    expect(scarce.prices['circuit-board']).toBe(Math.round((100 + COMPETITION.maxPercent) / 2));
    const flooded = advanceCompetition(recordSale(start, 'capacitor-reel', 600), 1975, start.nextMonth);
    expect(flooded.prices['capacitor-reel']).toBeLessThan(100);
    expect(flooded.lastSold).toEqual({ 'capacitor-reel': 600 });
    expect(flooded.sold).toEqual({});
  });

  it('fait grandir les rivaux sur un marché cher et rester dans leurs bornes', () => {
    const later = months(createCompetition(2017), 60);
    for (const rival of later.rivals) {
      for (const [market, units] of Object.entries(rival.supply)) {
        const bounds = supplyBounds(market as (typeof MARKET_IDS)[number]);
        expect(units).toBeGreaterThanOrEqual(bounds.min);
        expect(units).toBeLessThanOrEqual(bounds.max);
      }
    }
    expect(MARKET_IDS.every(market => later.prices[market] >= COMPETITION.minPercent && later.prices[market] <= COMPETITION.maxPercent)).toBe(true);
    // Sans l’entreprise, les rivaux finissent par servir à peu près la demande.
    expect(Math.abs(later.prices.office - 100)).toBeLessThanOrEqual(15);
  });

  it('donne une part de marché à l’entreprise qui vend beaucoup, au prix d’un indice plus bas', () => {
    const quiet = months(createCompetition(2017), 24);
    const busy = months(createCompetition(2017), 24, { 'capacitor-reel': 150 });
    expect(companyShare(busy, 'capacitor-reel')).toBeGreaterThan(30);
    expect(companyShare(quiet, 'capacitor-reel')).toBe(0);
    expect(busy.prices['capacitor-reel']).toBeLessThanOrEqual(quiet.prices['capacitor-reel']);
  });

  it('annonce les entrées et les guerres de prix, de la même façon dans chaque partie', () => {
    const first = months(createCompetition(1975), 24 * 12);
    const second = months(createCompetition(1975), 24 * 12);
    expect(first).toEqual(second);
    expect(first.news.length).toBeGreaterThan(0);
    const all: string[] = [];
    let competition = createCompetition(1975);
    for (let month = 0; month < 30 * 12; month++) {
      competition = advanceCompetition(competition, 1975, competition.nextMonth);
      all.push(...competition.news.map(news => news.kind));
    }
    expect(all).toContain('entry');
    expect(all).toContain('price-war');
  });

  it('paie le grossiste au prix du jour et compte la vente', () => {
    const world = createWorld('career');
    const career = careerOf(world);
    const cheap = { ...career, competition: { ...career.competition, prices: { ...career.competition.prices, 'bare-pcb': 80 } } };
    const sold = sellToMarket(cheap, 'bare-pcb');
    expect(sold.marketRevenueCents).toBe(Math.ceil((MARKET_PRICES['bare-pcb'] ?? 0) * 80 / 100));
    expect(sold.competition.sold).toEqual({ 'bare-pcb': 1 });
    expect(wholesalePrice('bare-pcb', 10, 80)).toBe(Math.ceil((MARKET_PRICES['bare-pcb'] ?? 0) * 110 * 80 / 10_000));
  });

  it('rejette un indice, un rival ou une offre hors des règles', () => {
    const world = createWorld('career', { startYear: 1975 });
    const career = careerOf(world);
    const forged = (competition: Partial<CompetitionState>) =>
      checkIntegrity({ ...world, progress: { ...world.progress, career: { ...career, competition: { ...career.competition, ...competition } } } });
    expect(checkIntegrity(world)).toBe(true);
    expect(forged({ prices: { ...career.competition.prices, office: 200 } })).toBe(false);
    expect(forged({ rivals: [...career.competition.rivals, { id: 'xinhe', supply: {} }] })).toBe(false);
    expect(forged({ rivals: [{ id: 'helion', supply: { office: 10 } }] })).toBe(false);
    expect(forged({ rivals: [{ id: 'helion', supply: { 'capacitor-reel': 9_999 } }] })).toBe(false);
    expect(forged({ nextMonth: 123 })).toBe(false);
  });
});
