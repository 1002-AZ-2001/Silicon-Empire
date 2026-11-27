import { TIME } from './construction';
import type { MilestoneId } from './progression';

/**
 * Workshop staff. Operators are assigned to production machines (assembler, tester, packager);
 * their skill changes the batch time and, on professional quality control, the rejection rhythm.
 * Candidates come from a pool renewed at a fixed rhythm; names and skills are drawn deterministically.
 */
export const SKILL_LEVELS = [1, 2, 3, 4, 5] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

export const STAFF = {
  /** One pay period ("month") lasts five simulated minutes. */
  payPeriodTicks: TIME.ticksPerSecond * 300,
  /** The candidate pool is replaced every three simulated minutes. */
  poolRefreshTicks: TIME.ticksPerSecond * 180,
  poolSize: 5,
  /** Offices can add candidates up to this pool size. */
  maxPoolSize: 8,
  maxEmployees: 40,
  /** Monthly salary asked at each skill level, before the candidate's own variation. */
  baseSalaryCents: { 1: 60_000, 2: 80_000, 3: 100_000, 4: 130_000, 5: 170_000 },
  /** A candidate asks between 85 % and 115 % of the base salary of their level, in steps of 5 %. */
  salaryVariationPercent: { min: 85, max: 115, step: 5 },
  /** Batch time in percent of the recipe time, by skill. */
  batchPercent: { 1: 125, 2: 110, 3: 100, 4: 90, 5: 80 },
  /** Rejection rhythm in percent on professional testing (8 → 12 at level 4, 16 at level 5). */
  rejectionEveryPercent: { 1: 100, 2: 100, 3: 100, 4: 150, 5: 200 },
  /** Dismissal costs half a month of salary. */
  severancePercent: 50,
  morale: { initial: 70, paid: 10, unpaid: 40 },
  /** Operators the Direction assigns for free when staffing becomes required (skill and salary of level 2). */
  baseOperatorSkill: 2,
  /** In progression, production machines need an operator once this milestone is completed. */
  requiredFrom: 'packaging' as MilestoneId,
} as const;

/** Fictional first and family names for candidates. */
export const STAFF_NAMES = {
  first: [
    'Alix', 'Bastien', 'Chloé', 'Dario', 'Elena', 'Farid', 'Gaëlle', 'Hugo', 'Inès', 'Joris', 'Kenza', 'Léon',
    'Maëlys', 'Nils', 'Olga', 'Paolo', 'Quentin', 'Rania', 'Sacha', 'Théa', 'Ugo', 'Vera', 'Yanis', 'Zoé',
  ],
  last: [
    'Arnaud', 'Berthier', 'Castel', 'Delorme', 'Esteve', 'Fabre', 'Garnier', 'Hamel', 'Iriarte', 'Jacquet', 'Kessler', 'Lemaire',
    'Marchetti', 'Navarro', 'Ollivier', 'Pagès', 'Quintin', 'Roussel', 'Sauvage', 'Tessier', 'Urbain', 'Vidal', 'Weber', 'Yildiz',
  ],
} as const;
