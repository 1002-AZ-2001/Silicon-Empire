import { LEVELS, POWER, POWER_SOURCES, POWER_USE_KW, WEAR } from '@silicon-empire/game-data';
import type { Recipe, SkillLevel } from '@silicon-empire/game-data';
import { tilesOf } from './rooms';
import { developerPercent } from './company';
import { batchTicks } from './staff';
import type { Machine, World } from './world';

export interface PowerNetwork {
  readonly supplyKw: number;
  readonly demandKw: number;
  /** Share of the demand the sources cover, from 0 to 1. */
  readonly ratio: number;
  /** kW drawn on grid connections, which the monthly bill charges. */
  readonly gridDemandKw: number;
  readonly generators: number;
}

export interface PowerMap {
  readonly networks: readonly PowerNetwork[];
  /** Network index of each machine touching a cable, by machine id. */
  readonly machineNetwork: ReadonlyMap<number, number>;
}

/** kW a machine draws at its level; 0 for machines without a motor. */
export function powerUse(machine: Machine): number {
  return Math.ceil((POWER_USE_KW[machine.type] ?? 0) * LEVELS[machine.level ?? 1].powerPercent / 100);
}

const cache = new WeakMap<readonly Machine[], { cables: readonly number[]; cut: boolean; map: PowerMap }>();

/**
 * Cables form networks of orthogonally adjacent tiles. A machine joins every network with a cable on
 * or next to its footprint, and joins those networks together. Grid connections deliver nothing while
 * the bill is unpaid.
 */
export function powerOf(world: Pick<World, 'machines' | 'cables' | 'columns' | 'rows' | 'utilities'>): PowerMap {
  const cached = cache.get(world.machines);
  if (cached && cached.cables === world.cables && cached.cut === world.utilities.cut) return cached.map;
  const { columns, rows } = world;
  const parent = new Map<number, number>();
  const find = (tile: number): number => {
    let root = tile;
    while (parent.get(root) !== root) root = parent.get(root) as number;
    return root;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(Math.max(ra, rb), Math.min(ra, rb));
  };
  for (const tile of world.cables) parent.set(tile, tile);
  for (const tile of world.cables) {
    if (tile % columns < columns - 1 && parent.has(tile + 1)) join(tile, tile + 1);
    if (parent.has(tile + columns)) join(tile, tile + columns);
  }
  const touched = new Map<number, number>();
  for (const machine of world.machines) {
    if (!POWER_USE_KW[machine.type] && !POWER_SOURCES[machine.type]) continue;
    const cables = new Set<number>();
    for (const tile of tilesOf(machine, columns)) {
      const x = tile % columns;
      const y = Math.floor(tile / columns);
      for (const next of [tile, x > 0 ? tile - 1 : -1, x < columns - 1 ? tile + 1 : -1, y > 0 ? tile - columns : -1, y < rows - 1 ? tile + columns : -1]) {
        if (next >= 0 && parent.has(next)) cables.add(next);
      }
    }
    const [first, ...others] = [...cables];
    if (first === undefined) continue;
    for (const other of others) join(first, other);
    touched.set(machine.id, first);
  }
  const roots = new Map<number, number>();
  const totals: { supply: number; demand: number; grid: number; gridDemand: number; generators: number }[] = [];
  const machineNetwork = new Map<number, number>();
  for (const machine of world.machines) {
    const cable = touched.get(machine.id);
    if (cable === undefined) continue;
    const root = find(cable);
    let index = roots.get(root);
    if (index === undefined) {
      index = totals.length;
      roots.set(root, index);
      totals.push({ supply: 0, demand: 0, grid: 0, gridDemand: 0, generators: 0 });
    }
    machineNetwork.set(machine.id, index);
    const total = totals[index] as (typeof totals)[number];
    const source = POWER_SOURCES[machine.type];
    if (source) {
      const delivered = source.billPerKwCents > 0 && world.utilities.cut ? 0 : source.supplyKw;
      total.supply += delivered;
      if (source.billPerKwCents > 0) total.grid += delivered;
      else total.generators += 1;
    }
    total.demand += powerUse(machine);
  }
  const networks = totals.map(({ supply, demand, grid, generators }) => {
    const ratio = demand === 0 ? 1 : Math.min(1, supply / demand);
    // Generators run first; the grid covers the rest and bills it.
    const gridDemandKw = Math.min(grid, Math.max(0, demand - (supply - grid)));
    return { supplyKw: supply, demandKw: demand, ratio, gridDemandKw, generators };
  });
  const map = { networks, machineNetwork };
  cache.set(world.machines, { cables: world.cables, cut: world.utilities.cut, map });
  return map;
}

/** Share of its power a machine receives: 1 when utilities are off or it needs none. */
export function powerRatio(world: World, machine: Machine): number {
  if (!world.utilities.enabled || !POWER_USE_KW[machine.type]) return 1;
  const { networks, machineNetwork } = powerOf(world);
  const index = machineNetwork.get(machine.id);
  return index === undefined ? 0 : networks[index]?.ratio ?? 0;
}

export function wearOf(world: World, machine: Machine): number {
  return world.wear[machine.id] ?? 0;
}

export function brokenDown(world: World, machine: Machine): boolean {
  return world.utilities.enabled && wearOf(world, machine) >= WEAR.breakdown;
}

/**
 * Ticks the next batch of a machine takes: level and operator, then wear past `WEAR.slowFrom`,
 * then the share of power it receives. Null when it cannot start (no power or broken down).
 */
export function productionTicks(world: World, machine: Machine, recipe: Recipe, skill?: SkillLevel): number | null {
  const tested = batchTicks(recipe, machine, skill);
  // Developers shorten test benches with their test software.
  const base = machine.type === 'tester' ? Math.ceil(tested * developerPercent(world) / 100) : tested;
  if (!world.utilities.enabled) return base;
  const ratio = powerRatio(world, machine);
  if (ratio <= 0 || brokenDown(world, machine)) return null;
  const worn = wearOf(world, machine) >= WEAR.slowFrom ? Math.ceil(base * WEAR.slowPercent / 100) : base;
  return Math.ceil(worn / ratio);
}

/** Bill for the month: grid kW drawn and generator fuel. */
export function monthlyPowerBill(world: World): number {
  if (!world.utilities.enabled) return 0;
  return powerOf(world).networks.reduce((total, network) =>
    total + network.gridDemandKw * (POWER_SOURCES['grid-connection']?.billPerKwCents ?? 0) +
      network.generators * (POWER_SOURCES.generator?.monthlyCents ?? 0), 0);
}

/** Monthly bill day: paid in full, or the grid is cut until the next bill is paid. */
/** Monthly bill: the home workshop's, plus `extraDue` for the sites abroad. */
export function advanceUtilities(
  world: World, tick: number, capitalCents: number, extraDue = 0,
): { utilities: World['utilities']; capitalCents: number } {
  const { utilities } = world;
  if (!utilities.enabled || tick < utilities.nextBill) return { utilities, capitalCents };
  // The bill is computed as if the grid were connected, so that paying it lifts the cut.
  const due = monthlyPowerBill({ ...world, utilities: { ...utilities, cut: false } }) + extraDue;
  const nextBill = utilities.nextBill + POWER.billPeriodTicks;
  if (capitalCents >= due) {
    return { utilities: { ...utilities, cut: false, nextBill, spentCents: utilities.spentCents + due }, capitalCents: capitalCents - due };
  }
  return { utilities: { ...utilities, cut: true, nextBill }, capitalCents };
}
