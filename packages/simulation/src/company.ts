import {
  BRAND_COLORS, BRAND_EMBLEMS, LAND, OFFICE_ROLES, PURCHASE, ROLE_EFFECTS, UPGRADE_COSTS, WEAR,
} from '@silicon-empire/game-data';
import type { BrandColor, BrandEmblem, ItemType, Role, UpgradeLevel } from '@silicon-empire/game-data';
import { orderableItems } from './progress';
import { roomsOf } from './rooms';
import type { Machine, World } from './world';

/** Brand chosen in the company menu. */
export interface Company {
  readonly color: BrandColor;
  readonly emblem: BrandEmblem;
}

export const DEFAULT_COMPANY: Company = { color: 'lime', emblem: 'chip' };

export function validCompany(company: Company): boolean {
  return BRAND_COLORS.includes(company.color) && BRAND_EMBLEMS.includes(company.emblem);
}

/** Office computers standing in offices. */
export function workstations(world: World): number {
  return roomsOf(world).rooms.reduce((total, room) => total + (room.type === 'office' ? room.workstations : 0), 0);
}

/**
 * Office employees who have a workstation, by role. Workstations go to office employees in hiring
 * order; those without one do not count.
 */
export function equippedByRole(world: World): Readonly<Record<Role, number>> {
  const counts: Record<Role, number> = {
    operator: 0, technician: 0, storekeeper: 0, researcher: 0, developer: 0, designer: 0, manager: 0, sales: 0,
  };
  const equipped = equippedEmployees(world);
  for (const employee of world.staff.employees) if (equipped.has(employee.id)) counts[employee.role] += 1;
  return counts;
}

/** Ids of the employees who can work: every non-office employee, and office employees with a workstation. */
export function equippedEmployees(world: World): ReadonlySet<number> {
  let seats = workstations(world);
  const ids = new Set<number>();
  for (const employee of world.staff.employees) {
    if (!OFFICE_ROLES.includes(employee.role)) ids.add(employee.id);
    else if (seats > 0) {
      ids.add(employee.id);
      seats -= 1;
    }
  }
  return ids;
}

/**
 * Whether a role can be hired. Sandbox: all. Classic: researchers with the laboratory, storekeepers with
 * the Warehouse milestone, developers with Quality control, designers and sales with Packaging.
 * Career: storekeepers with board assembly, developers with computers, designers with automation.
 */
export function roleUnlocked(world: Pick<World, 'progress' | 'research'>, role: Role, labUnlocked: boolean): boolean {
  const { progress } = world;
  if (progress.sandbox || role === 'operator' || role === 'technician' || role === 'manager') return true;
  if (role === 'researcher') return labUnlocked;
  const career = progress.career;
  if (career) {
    const owns = (tech: (typeof career.technologies)[number]) => career.technologies.includes(tech);
    if (role === 'storekeeper') return owns('smt');
    if (role === 'developer') return owns('computers');
    if (role === 'designer') return owns('automation');
    return true;
  }
  const done = (milestone: (typeof progress.completed)[number]) => progress.completed.includes(milestone);
  if (role === 'storekeeper') return done(LAND.requiredFrom);
  if (role === 'developer') return done('quality-control');
  return done('packaging');
}

/** Upgrade price after the discount of equipped designers. */
export function upgradeCost(world: World, machine: Machine, level: UpgradeLevel): number | undefined {
  const base = UPGRADE_COSTS[machine.type]?.[level];
  if (base === undefined) return undefined;
  const designers = Math.min(ROLE_EFFECTS.maxDesigners, equippedByRole(world).designer);
  return Math.ceil(base * (100 - designers * ROLE_EFFECTS.designerPercent) / 100);
}

/** Price rise in percent that equipped salespeople obtain on customer orders and wholesale. */
export function salesBonusPercent(world: World): number {
  return Math.min(ROLE_EFFECTS.maxSales, equippedByRole(world).sales) * ROLE_EFFECTS.salesPercent;
}

/** Batch time of test benches in percent, shortened by equipped developers. */
export function developerPercent(world: World): number {
  return 100 - Math.min(ROLE_EFFECTS.maxDevelopers, equippedByRole(world).developer) * ROLE_EFFECTS.developerPercent;
}

/** Extra analysis ticks per tick from equipped researchers. */
export function researchBoost(world: World): number {
  return Math.min(ROLE_EFFECTS.maxResearchers, equippedByRole(world).researcher);
}

export function managerMorale(world: World): number {
  return Math.min(ROLE_EFFECTS.maxManagers, equippedByRole(world).manager) * ROLE_EFFECTS.managerMorale;
}

/** Technicians each remove wear from the most worn machine, most worn first, ties by machine id. */
export function technicianRepairs(world: World, wear: Readonly<Record<string, number>>): Readonly<Record<string, number>> {
  let next = wear;
  for (const technician of world.staff.employees) {
    if (technician.role !== 'technician') continue;
    const worst = Object.entries(next).sort(([a, x], [b, y]) => y - x || Number(a) - Number(b))[0];
    if (!worst) break;
    const [id, value] = worst;
    const left = value - ROLE_EFFECTS.repairPerSkill * technician.skill;
    const copy: Record<string, number> = { ...next };
    if (left > 0) copy[id] = Math.min(WEAR.breakdown, left);
    else delete copy[id];
    next = copy;
  }
  return next;
}

/** Restock list of a receiving dock with a storekeeper: the first listed item it is short of. */
export function restockItem(world: World, dock: Machine, stock: Readonly<Partial<Record<ItemType, number>>>): ItemType | undefined {
  const orderable = orderableItems(world.progress);
  return dock.restock?.find(item => orderable.has(item) && (stock[item] ?? 0) < PURCHASE.lotSize);
}

