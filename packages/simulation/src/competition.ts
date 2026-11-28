import { CALENDAR, COMPETITION, MARKET_DEMAND, MARKET_IDS, RIVALS, RIVAL_IDS, dateAt } from '@silicon-empire/game-data';
import type { MarketId, RivalId } from '@silicon-empire/game-data';

/** Units a rival sells per month on each of its markets. */
export interface RivalState {
  readonly id: RivalId;
  readonly supply: Readonly<Partial<Record<MarketId, number>>>;
}

export type MarketNewsKind = 'entry' | 'price-war';

export interface MarketNews {
  readonly tick: number;
  readonly kind: MarketNewsKind;
  readonly rival: RivalId;
  readonly market: MarketId | null;
}

export interface CompetitionState {
  /** Price index of each market, in percent of the reference price. */
  readonly prices: Readonly<Record<MarketId, number>>;
  /** Rivals already on the markets, in `RIVAL_IDS` order. */
  readonly rivals: readonly RivalState[];
  /** Units the company sold this month and last month. */
  readonly sold: Readonly<Partial<Record<MarketId, number>>>;
  readonly lastSold: Readonly<Partial<Record<MarketId, number>>>;
  /** First tick of the next month. */
  readonly nextMonth: number;
  /** Latest news first. */
  readonly news: readonly MarketNews[];
}

const REFERENCE = Object.fromEntries(MARKET_IDS.map(market => [market, 100])) as Record<MarketId, number>;

function entrySupply(id: RivalId): Partial<Record<MarketId, number>> {
  return Object.fromEntries(Object.entries(RIVALS[id].markets).map(([market, share]) =>
    [market, Math.round(MARKET_DEMAND[market as MarketId] * (share ?? 0) / 100)]));
}

/** Competition of a career starting at `tick`: the rivals of its start year, prices at the reference. */
export function createCompetition(startYear: number, tick = 0): CompetitionState {
  const year = dateAt(startYear, tick).year;
  return {
    prices: REFERENCE,
    rivals: RIVAL_IDS.filter(id => RIVALS[id].entryYear <= year).map(id => ({ id, supply: entrySupply(id) })),
    sold: {}, lastSold: {},
    nextMonth: (Math.floor(tick / CALENDAR.monthTicks) + 1) * CALENDAR.monthTicks,
    news: [],
  };
}

/** Small deterministic generator (mulberry32): the same month brings the same events in every game. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Records units the company sold on a market. */
export function recordSale(competition: CompetitionState, market: MarketId, units: number): CompetitionState {
  if (units <= 0) return competition;
  return { ...competition, sold: { ...competition.sold, [market]: (competition.sold[market] ?? 0) + units } };
}

/** Units every rival together sells on a market per month. */
export function rivalSupply(competition: CompetitionState, market: MarketId): number {
  return competition.rivals.reduce((total, rival) => total + (rival.supply[market] ?? 0), 0);
}

/** Share of the market the company had last month, in percent. */
export function companyShare(competition: CompetitionState, market: MarketId): number {
  const own = competition.lastSold[market] ?? 0;
  const total = own + rivalSupply(competition, market);
  return total === 0 ? 0 : Math.round(own * 100 / total);
}

/**
 * Closes the month on its first tick: new rivals enter, some start a price war, every price moves
 * half-way towards the level the total supply allows, then rivals grow or shrink with the price.
 */
export function advanceCompetition(competition: CompetitionState, startYear: number, tick: number): CompetitionState {
  if (tick < competition.nextMonth) return competition;
  const month = Math.floor(tick / CALENDAR.monthTicks);
  const next = random(Math.imul(month + 1, 2_654_435_761) ^ 0x5bd1e995);
  const year = dateAt(startYear, tick).year;
  let news = [...competition.news];
  const announce = (kind: MarketNewsKind, rival: RivalId, market: MarketId | null) => {
    news = [{ tick, kind, rival, market }, ...news].slice(0, COMPETITION.maxNews);
  };

  const entered = new Set(competition.rivals.map(rival => rival.id));
  const rivals = RIVAL_IDS.flatMap(id => {
    const current = competition.rivals.find(rival => rival.id === id);
    if (current) return [current];
    if (RIVALS[id].entryYear > year) return [];
    if (!entered.has(id)) announce('entry', id, null);
    return [{ id, supply: entrySupply(id) }];
  });

  const wars: Partial<Record<MarketId, number>> = {};
  for (const rival of rivals) {
    const markets = Object.keys(RIVALS[rival.id].markets) as MarketId[];
    if (next() * 100 >= RIVALS[rival.id].aggressiveness || markets.length === 0) continue;
    const market = markets[Math.floor(next() * markets.length)] as MarketId;
    wars[market] = (wars[market] ?? 0) + Math.round(MARKET_DEMAND[market] * COMPETITION.priceWarPercent / 100);
    announce('price-war', rival.id, market);
  }

  const prices = Object.fromEntries(MARKET_IDS.map(market => {
    const demand = MARKET_DEMAND[market];
    const supply = rivals.reduce((total, rival) => total + (rival.supply[market] ?? 0), 0) + (wars[market] ?? 0) + (competition.sold[market] ?? 0);
    const target = clamp(100 + COMPETITION.elasticity * (demand - supply) / demand, COMPETITION.minPercent, COMPETITION.maxPercent);
    return [market, clamp(Math.round((competition.prices[market] + target) / 2), COMPETITION.minPercent, COMPETITION.maxPercent)];
  })) as Record<MarketId, number>;

  const adjusted = rivals.map(rival => ({
    id: rival.id,
    supply: Object.fromEntries((Object.entries(rival.supply) as [MarketId, number][]).map(([market, units]) => {
      const step = Math.max(1, Math.round(units * COMPETITION.stepPercent / 100));
      const change = prices[market] >= COMPETITION.growFrom ? step : prices[market] < COMPETITION.shrinkFrom ? -step : 0;
      return [market, clamp(units + change, supplyBounds(market).min, supplyBounds(market).max)];
    })),
  }));

  return { prices, rivals: adjusted, sold: {}, lastSold: competition.sold, nextMonth: competition.nextMonth + CALENDAR.monthTicks, news };
}

/** Monthly supply a rival keeps on a market. */
export function supplyBounds(market: MarketId): { min: number; max: number } {
  const demand = MARKET_DEMAND[market];
  return {
    min: Math.round(demand * COMPETITION.minSupplyPercent / 100),
    max: Math.round(demand * COMPETITION.maxSupplyPercent / 100),
  };
}
