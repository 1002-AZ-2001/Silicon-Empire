import { CAREER, LOANS, LOAN_IDS, MARKET_PRICES, SPECIALTIES, STAFF, TECHNOLOGIES, TECH_IDS, instalment } from '@silicon-empire/game-data';
import type { ItemType, LoanId, Specialty, TechId } from '@silicon-empire/game-data';
import { addItems } from './inventory';
import type { Inventory } from './inventory';

export interface Loan {
  readonly offer: LoanId;
  /** Instalments still due. */
  readonly remaining: number;
}

/** State of a career workshop; absent in classic and sandbox workshops. */
export interface CareerState {
  readonly specialty: Specialty | null;
  /** Licences in purchase order; the specialty comes first, for free. */
  readonly technologies: readonly TechId[];
  readonly loans: readonly Loan[];
  readonly borrowedCents: number;
  /** Instalments and early repayments paid. */
  readonly repaidCents: number;
  /** Consecutive instalment days the company could not pay. */
  readonly missed: number;
  readonly bankrupt: boolean;
  readonly nextInstalment: number;
  readonly marketRevenueCents: number;
  /** Units sold to the wholesaler. */
  readonly marketShipped: Inventory;
}

export function createCareer(tick = 0): CareerState {
  return {
    specialty: null, technologies: [], loans: [], borrowedCents: 0, repaidCents: 0, missed: 0, bankrupt: false,
    nextInstalment: tick + STAFF.payPeriodTicks, marketRevenueCents: 0, marketShipped: {},
  };
}

export function isSpecialty(tech: TechId): tech is Specialty {
  return (SPECIALTIES as readonly TechId[]).includes(tech);
}

/** A licence can be bought once the specialty is chosen and its requirements are met. */
export function techAvailable(career: CareerState, tech: TechId): boolean {
  if (!TECH_IDS.includes(tech) || career.specialty === null || career.technologies.includes(tech)) return false;
  const { requires, branches } = TECHNOLOGIES[tech];
  return requires.every(required => career.technologies.includes(required)) &&
    career.technologies.filter(isSpecialty).length >= branches;
}

/** Capital spent on licences: every technology except the free specialty. */
export function techSpent(career: CareerState): number {
  return career.technologies.slice(1).reduce((total, tech) => total + TECHNOLOGIES[tech].costCents, 0);
}

export function loanAvailable(career: CareerState, offer: LoanId): boolean {
  return LOAN_IDS.includes(offer) && !career.bankrupt && !career.loans.some(loan => loan.offer === offer);
}

/** Early repayment: the share of the principal still due, without the remaining interest. */
export function payoff(loan: Loan): number {
  const offer = LOANS[loan.offer];
  return Math.ceil(offer.principalCents * loan.remaining / offer.months);
}

export function monthlyDue(career: CareerState): number {
  return career.loans.reduce((total, loan) => total + instalment(LOANS[loan.offer]), 0);
}

/** Instalment day: pays every loan or none; after `CAREER.maxMissed` misses in a row, the company is bankrupt. */
export function advanceCareer(career: CareerState, tick: number, capitalCents: number): { career: CareerState; capitalCents: number } {
  if (tick < career.nextInstalment) return { career, capitalCents };
  const nextInstalment = career.nextInstalment + STAFF.payPeriodTicks;
  const due = monthlyDue(career);
  if (due === 0) return { career: { ...career, nextInstalment }, capitalCents };
  if (capitalCents >= due) {
    const loans = career.loans.map(loan => ({ ...loan, remaining: loan.remaining - 1 })).filter(loan => loan.remaining > 0);
    return { career: { ...career, loans, repaidCents: career.repaidCents + due, missed: 0, nextInstalment }, capitalCents: capitalCents - due };
  }
  const missed = career.missed + 1;
  return { career: { ...career, missed, bankrupt: missed >= CAREER.maxMissed, nextInstalment }, capitalCents };
}

export function marketPrice(item: ItemType): number | undefined {
  return MARKET_PRICES[item];
}

/** Records one unit bought by the wholesaler. */
/** Wholesale price of a unit, raised by the sales bonus in percent. */
export function wholesalePrice(item: ItemType, bonusPercent = 0): number {
  return Math.ceil((MARKET_PRICES[item] ?? 0) * (100 + bonusPercent) / 100);
}

export function sellToMarket(career: CareerState, item: ItemType, bonusPercent = 0): CareerState {
  return {
    ...career,
    marketRevenueCents: career.marketRevenueCents + wholesalePrice(item, bonusPercent),
    marketShipped: addItems(career.marketShipped, item, 1),
  };
}
