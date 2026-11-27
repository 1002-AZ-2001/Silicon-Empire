import { LEVELS, ROLES, ROLE_EFFECTS, ROLE_WEIGHTS, ROOMS, SKILL_LEVELS, STAFF, STAFF_NAMES, UPGRADABLE_MACHINES } from '@silicon-empire/game-data';
import type { MachineType, Recipe, Role, SkillLevel, UpgradableMachine } from '@silicon-empire/game-data';
import type { Progress } from './progress';
import type { Machine } from './world';

/** Name, job, skill and monthly salary of a person, employed or not. */
export interface Person {
  readonly name: string;
  readonly role: Role;
  readonly skill: SkillLevel;
  readonly salaryCents: number;
}

/**
 * A candidate of the current pool. Ids are pool × base pool size + rank: unique within a pool, which is all
 * hiring needs, and unchanged from the v0.8.0 saves.
 */
export interface Candidate extends Person {
  readonly id: number;
}

export interface Employee extends Person {
  readonly id: number;
  /** 0 to 100. Raised by each paid month, lowered by each unpaid one; at 0 the employee leaves. */
  readonly morale: number;
  /**
   * Machine the employee works at: a production machine for an operator, a receiving dock for a
   * storekeeper. At most one employee per machine. Always null for the other roles.
   */
  readonly machineId: number | null;
}

export interface StaffState {
  /** In ascending id order. */
  readonly employees: readonly Employee[];
  /** Candidates still available from the current pool, in rank order. */
  readonly candidates: readonly Candidate[];
  readonly pool: number;
  readonly nextEmployeeId: number;
  /** Salaries and severance paid since the start. */
  readonly paidCents: number;
  readonly nextPayday: number;
  readonly nextPool: number;
}

/** Machines that take an operator: the production machines. */
export const STAFFED_MACHINES: readonly UpgradableMachine[] = UPGRADABLE_MACHINES;

export function isStaffed(type: MachineType): type is UpgradableMachine {
  return (STAFFED_MACHINES as readonly MachineType[]).includes(type);
}

/** Small deterministic generator (mulberry32), so that pools are identical in every game and after a reload. */
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

function pick<T>(list: readonly T[], next: () => number): T {
  return list[Math.floor(next() * list.length)] as T;
}

function nameFrom(next: () => number): string {
  return `${pick(STAFF_NAMES.first, next)} ${pick(STAFF_NAMES.last, next)}`;
}

export function baseSalary(skill: SkillLevel): number {
  return STAFF.baseSalaryCents[skill];
}

function roleFrom(draw: number): Role {
  let total = 0;
  for (const role of ROLES) {
    total += ROLE_WEIGHTS[role];
    if (draw < total) return role;
  }
  return 'operator';
}

/**
 * Candidates of a pool, before any hiring. Skills lean towards the middle levels. A larger pool
 * (offices) appends candidates: the first ones are the same whatever the size.
 */
export function candidatesFor(pool: number, size: number = STAFF.poolSize): Candidate[] {
  const next = random(Math.imul(pool + 1, 2_654_435_761));
  const { min, max, step } = STAFF.salaryVariationPercent;
  const steps = (max - min) / step + 1;
  return Array.from({ length: Math.min(size, STAFF.maxPoolSize) }, (_, rank) => {
    const name = nameFrom(next);
    const skill = SKILL_LEVELS[Math.min(4, Math.floor((next() + next()) * 2.5))] ?? 3;
    const percent = min + Math.floor(next() * steps) * step;
    // Roles come from their own sequence, so names and skills stay those of earlier versions.
    const role = rank === 0 ? 'operator' : roleFrom(random(Math.imul(pool + 1, 3_266_489_917) ^ (rank * 668_265_263))() * 100);
    return {
      id: pool * STAFF.poolSize + rank, name, role, skill,
      // Rounded to the euro.
      salaryCents: Math.round(baseSalary(skill) * percent / 100 * ROLE_EFFECTS.salaryPercent[role] / 10_000) * 100,
    };
  });
}

/** Staff of a new workshop, or of an older save resumed at `tick`: nobody employed, the first pool on offer. */
export function createStaff(tick = 0): StaffState {
  return {
    employees: [], candidates: candidatesFor(0), pool: 0, nextEmployeeId: 1, paidCents: 0,
    nextPayday: tick + STAFF.payPeriodTicks, nextPool: tick + STAFF.poolRefreshTicks,
  };
}

/** In progression, production machines need an operator once staffing is unlocked. Never in sandbox. */
export function staffRequired(progress: Progress): boolean {
  return !progress.sandbox && progress.completed.includes(STAFF.requiredFrom);
}

/** Employee working at a machine: its operator, or the storekeeper of a dock. */
export function operatorOf(staff: StaffState, machineId: number): Employee | undefined {
  return staff.employees.find(employee => employee.machineId === machineId);
}

/** Machine a role works at, if any: operators at production machines, storekeepers at receiving docks. */
export function postAccepts(role: Role, type: MachineType): boolean {
  return role === 'operator' ? isStaffed(type) : role === 'storekeeper' && type === 'receiving';
}

export function payroll(staff: StaffState): number {
  return staff.employees.reduce((total, employee) => total + employee.salaryCents, 0);
}

export function severance(employee: Employee): number {
  return Math.floor(employee.salaryCents * STAFF.severancePercent / 100);
}

/** Ticks a batch takes: the machine level divides the recipe time, then the operator's skill scales it. */
export function batchTicks(recipe: Recipe, machine: Machine | undefined, skill?: SkillLevel): number {
  const base = Math.ceil(recipe.ticks / LEVELS[machine?.level ?? 1].speed);
  return skill === undefined ? base : Math.ceil(base * STAFF.batchPercent[skill] / 100);
}

/** Rejection rhythm on a machine, given the workshop rhythm and the operator's skill. */
export function operatorRejection(every: number | null, skill?: SkillLevel): number | null {
  if (every === null || skill === undefined) return every;
  return Math.floor(every * STAFF.rejectionEveryPercent[skill] / 100);
}

/**
 * Gives every staffed machine without an operator a free level-2 operator from the Direction.
 * Used when staffing becomes required, so that a running line does not stop at once.
 */
export function assignBaseOperators(staff: StaffState, machines: readonly { readonly id: number; readonly type: MachineType }[]): StaffState {
  let { nextEmployeeId } = staff;
  const added: Employee[] = [];
  for (const machine of machines) {
    if (!isStaffed(machine.type) || operatorOf(staff, machine.id)) continue;
    if (staff.employees.length + added.length >= STAFF.maxEmployees) break;
    const skill = STAFF.baseOperatorSkill;
    added.push({
      id: nextEmployeeId, name: nameFrom(random(Math.imul(nextEmployeeId, 2_246_822_519))), role: 'operator', skill,
      salaryCents: baseSalary(skill), morale: STAFF.morale.initial, machineId: machine.id,
    });
    nextEmployeeId += 1;
  }
  return added.length === 0 ? staff : { ...staff, employees: [...staff.employees, ...added], nextEmployeeId };
}

/**
 * Runs the staff calendar for one tick: renews the candidate pool, then pays salaries on payday.
 * Unpaid employees lose morale and leave at zero. Returns the staff and the capital left.
 */
/** Room effects on staff, read only on the ticks that need them. */
export interface StaffEffects {
  /** Extra morale on a paid month, from equipped managers. */
  readonly managerMorale: number;
  /** Every employee has a seat in a break room. */
  readonly rested: boolean;
  readonly poolSize: number;
}

export function advanceStaff(
  staff: StaffState, tick: number, capitalCents: number, effects: () => StaffEffects,
): { staff: StaffState; capitalCents: number } {
  let next = staff;
  if (tick >= staff.nextPool) {
    const pool = staff.pool + 1;
    next = { ...next, pool, candidates: candidatesFor(pool, effects().poolSize), nextPool: staff.nextPool + STAFF.poolRefreshTicks };
  }
  if (tick >= staff.nextPayday) {
    const due = payroll(next);
    const paid = capitalCents >= due;
    const { paid: rested, unpaid: drop } = effects().rested ? ROOMS.restedMorale : STAFF.morale;
    const raise = rested + effects().managerMorale;
    const employees = next.employees
      .map(employee => ({ ...employee, morale: paid ? Math.min(100, employee.morale + raise) : Math.max(0, employee.morale - drop) }))
      .filter(employee => employee.morale > 0);
    next = {
      ...next,
      employees: next.employees.length === 0 ? next.employees : employees,
      paidCents: next.paidCents + (paid ? due : 0),
      nextPayday: staff.nextPayday + STAFF.payPeriodTicks,
    };
    if (paid) capitalCents -= due;
  }
  return { staff: next, capitalCents };
}
