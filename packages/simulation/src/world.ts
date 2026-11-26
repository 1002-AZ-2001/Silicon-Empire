import {
  CUSTOM_ITEMS, ITEMS, ITEM_TYPES, MACHINES, MAX_LINE_LENGTH, MK2, PURCHASE, STAFF, SUPPLIERS, WORKSHOP,
  designParts, designPower, isConveyor, pcDesignSchema, recipeOf, saleOffer,
} from '@silicon-empire/game-data';
import type {
  ConveyorType, Direction, ItemType, MachineType, MilestoneId, PcDesign, ProductModel, PublishedDesign, ResearchId,
  SupplierId,
} from '@silicon-empire/game-data';
import { addItems, fitsInputStock, inventoryTotal, mergeInventories } from './inventory';
import type { Inventory } from './inventory';
import { createProgress, milestoneAvailable, modelUnlocked, orderableItems, unlockedMachines } from './progress';
import type { Progress } from './progress';
import { NO_RESEARCH, capacityOf, researchAvailable, researchMachines, upgradeUnlocked } from './research';
import type { ResearchState } from './research';
import type { Sales } from './sales';
import { assignBaseOperators, createStaff, isStaffed, severance, staffRequired } from './staff';
import type { Employee, StaffState } from './staff';

export const ROTATIONS = [0, 1, 2, 3] as const satisfies readonly Direction[];
export type Rotation = (typeof ROTATIONS)[number];

export interface Tile {
  readonly x: number;
  readonly y: number;
}

export interface Placement extends Tile {
  readonly type: MachineType;
  readonly rotation: Rotation;
}

/** Outputs of a splitter, relative to the direction it faces. */
export const ROUTER_SIDES = ['left', 'front', 'right'] as const;
export type RouterSide = (typeof ROUTER_SIDES)[number];

/** Sends every unit of one component to one splitter output; other units share the remaining outputs. */
export interface RouterFilter {
  readonly item: ItemType;
  readonly output: RouterSide;
}

export interface Machine extends Placement {
  readonly id: number;
  readonly paidCents: number;
  /** Splitters only. */
  readonly filter?: RouterFilter;
  /** Production machines only. Defaults to office, including in older saved workshops. */
  readonly model?: ProductModel;
  /** Production machines upgraded after research run their batches faster. Absent means Mk1. */
  readonly level?: 2;
}

/** Unit held by a splitter or merger, and the side it serves next. */
export interface RouterState {
  readonly held: { readonly id: number; readonly item: ItemType } | null;
  /** Index in left, front/back, right order of the next output (splitter) or input (merger) to try. */
  readonly cursor: number;
}

export interface Footprint extends Tile {
  readonly width: number;
  readonly height: number;
}

/** A unit travelling on a conveyor. Position runs from 0 (entry edge) to the belt length minus 1. */
export interface BeltItem {
  readonly id: number;
  readonly item: ItemType;
  readonly position: number;
}

/**
 * Units entering and leaving the workshop. For every item type:
 * purchased + produced = held (stocks, belts, routers, production) + discarded + consumed + delivered.
 */
export interface Ledger {
  readonly purchased: Inventory;
  readonly discarded: Inventory;
  readonly purchaseSpentCents: number;
  /** Units made by production machines, counted when a batch starts. */
  readonly produced: Inventory;
  /** Recipe inputs used by production machines. */
  readonly consumed: Inventory;
  /** Units delivered to the headquarters for milestones. */
  readonly delivered: Inventory;
}

/** State of a production machine. Its input buffer is its entry in `stocks`. */
export interface ProductionState {
  /** Unit being made: its inputs are already consumed. */
  readonly batch: { readonly item: ItemType; readonly remaining: number } | null;
  /** Finished units waiting for the output port. */
  readonly output: Inventory;
}

export interface PendingDelivery {
  readonly dockId: number;
  readonly item: ItemType;
  readonly supplier: SupplierId;
  readonly dueTick: number;
}

export interface World {
  readonly columns: number;
  readonly rows: number;
  readonly tick: number;
  readonly capitalCents: number;
  readonly nextMachineId: number;
  readonly nextItemId: number;
  /** Building layout, in ascending id order. Unchanged by ticks. */
  readonly machines: readonly Machine[];
  /** Machine inventories by machine id. Empty inventories are absent. */
  readonly stocks: Readonly<Record<string, Inventory>>;
  /** Units on each conveyor by conveyor id, front unit first. Empty belts are absent. */
  readonly belts: Readonly<Record<string, readonly BeltItem[]>>;
  /** Splitter and merger states by machine id. Empty routers with cursor 0 are absent. */
  readonly routers: Readonly<Record<string, RouterState>>;
  /** Production machine states by machine id. Idle machines with an empty output are absent. */
  readonly production: Readonly<Record<string, ProductionState>>;
  readonly progress: Progress;
  readonly sales: Sales;
  readonly design: PublishedDesign | null;
  readonly deliveries: readonly PendingDelivery[];
  readonly research: ResearchState;
  readonly staff: StaffState;
  readonly ledger: Ledger;
}

/** One tile of a conveyor line; the direction is the rotation. */
export interface LineTile extends Tile {
  readonly rotation: Rotation;
}

export type Command =
  | ({ readonly kind: 'build' } & Placement)
  | { readonly kind: 'build-line'; readonly tiles: readonly LineTile[]; readonly type?: ConveyorType }
  | { readonly kind: 'select-milestone'; readonly milestone: MilestoneId | null }
  | { readonly kind: 'select-research'; readonly research: ResearchId | null }
  | { readonly kind: 'upgrade'; readonly id: number }
  | { readonly kind: 'start-sale'; readonly model: ProductModel }
  | { readonly kind: 'cancel-sale' }
  | { readonly kind: 'publish-design'; readonly spec: PcDesign }
  | { readonly kind: 'configure'; readonly id: number; readonly filter: RouterFilter | null }
  | { readonly kind: 'set-product-model'; readonly id: number; readonly model: ProductModel }
  | { readonly kind: 'rotate'; readonly id: number }
  | { readonly kind: 'demolish'; readonly id: number }
  | { readonly kind: 'order'; readonly id: number; readonly item: ItemType; readonly supplier?: SupplierId }
  | { readonly kind: 'purchase'; readonly id: number; readonly lines: readonly PurchaseLine[] }
  | { readonly kind: 'hire'; readonly candidate: number }
  | { readonly kind: 'fire'; readonly employee: number }
  | { readonly kind: 'assign'; readonly employee: number; readonly machine: number | null };

/** One line of a shop order: `lots` lots of one component from one supplier. */
export interface PurchaseLine {
  readonly item: ItemType;
  readonly supplier: SupplierId;
  readonly lots: number;
}

type FootprintError = 'out-of-bounds' | 'occupied';
type BuildError = FootprintError | 'insufficient-funds' | 'id-limit' | 'invalid-line' | 'locked' | 'unique';
type OrderError = 'not-a-dock' | 'insufficient-funds' | 'dock-full' | 'id-limit' | 'locked' | 'empty-order' | 'invalid-order';
type ModelError = 'not-a-producer' | 'locked' | 'production-busy' | 'incompatible-inputs' | 'design-required';
type SaleError = 'no-shipping-dock' | 'sale-in-progress' | 'sale-already-shipped';
type DesignError = 'design-invalid' | 'design-power' | 'design-in-use';
export type CommandError = BuildError | OrderError | ModelError | SaleError | DesignError |
  'missing-machine' | 'not-a-splitter' | 'milestone-unavailable' | 'deliveries-pending' |
  'research-unavailable' | 'not-upgradable' | 'missing-candidate' | 'missing-employee' | 'staff-full' | 'not-staffed';

export type CommandResult =
  | { readonly ok: true; readonly world: World; readonly machine: Machine | null }
  | { readonly ok: false; readonly reason: CommandError };

export const EMPTY_LEDGER: Ledger = {
  purchased: {}, discarded: {}, purchaseSpentCents: 0, produced: {}, consumed: {}, delivered: {},
};

/** A new workshop. Sandbox mode unlocks everything; progression mode starts at tier 0. */
export function createWorld(mode: 'sandbox' | 'progression' = 'sandbox'): World {
  return {
    columns: WORKSHOP.columns,
    rows: WORKSHOP.rows,
    tick: 0,
    capitalCents: WORKSHOP.initialCapitalCents,
    nextMachineId: 1,
    nextItemId: 1,
    machines: [],
    stocks: {},
    belts: {},
    routers: {},
    production: {},
    progress: createProgress(mode === 'sandbox'),
    sales: { active: null, completed: [] },
    design: null,
    deliveries: [],
    research: NO_RESEARCH,
    staff: createStaff(),
    ledger: EMPTY_LEDGER,
  };
}

/** Buildings available now: unlocked by milestones or by research. */
export function machineUnlocked(world: Pick<World, 'progress' | 'research'>, type: MachineType): boolean {
  return unlockedMachines(world.progress).has(type) || researchMachines(world.progress, world.research).includes(type);
}

export function turnClockwise(rotation: Rotation): Rotation {
  return ROTATIONS[rotation + 1] ?? ROTATIONS[0];
}

export function footprintOf({ type, rotation, x, y }: Placement): Footprint {
  const { width, height } = MACHINES[type];
  const sideways = rotation % 2 === 1;
  return { x, y, width: sideways ? height : width, height: sideways ? width : height };
}

export function fitsMap(world: Pick<World, 'columns' | 'rows'>, footprint: Footprint): boolean {
  const { x, y, width, height } = footprint;
  return (
    Number.isInteger(x) && Number.isInteger(y) &&
    x >= 0 && y >= 0 && x + width <= world.columns && y + height <= world.rows
  );
}

function containsTile(rectangle: Footprint, tile: Tile): boolean {
  return tile.x >= rectangle.x && tile.x < rectangle.x + rectangle.width &&
    tile.y >= rectangle.y && tile.y < rectangle.y + rectangle.height;
}

function footprintsIntersect(a: Footprint, b: Footprint): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width &&
    a.y < b.y + b.height && b.y < a.y + a.height;
}

export function machineAt(world: Pick<World, 'machines'>, tile: Tile): Machine | undefined {
  return world.machines.find(machine => containsTile(footprintOf(machine), tile));
}

function checkFootprint(world: World, placement: Placement, ignoreId?: number): FootprintError | null {
  const footprint = footprintOf(placement);
  if (!fitsMap(world, footprint)) return 'out-of-bounds';
  if (world.machines.some(machine =>
    machine.id !== ignoreId && footprintsIntersect(footprintOf(machine), footprint)
  )) return 'occupied';
  return null;
}

export function checkBuild(world: World, placement: Placement): BuildError | null {
  if (!machineUnlocked(world, placement.type)) return 'locked';
  if (placement.type === 'headquarters' && world.machines.some(machine => machine.type === 'headquarters')) return 'unique';
  const footprintError = checkFootprint(world, placement);
  if (footprintError) return footprintError;
  if (world.capitalCents < MACHINES[placement.type].costCents) return 'insufficient-funds';
  if (world.nextMachineId >= Number.MAX_SAFE_INTEGER) return 'id-limit';
  return null;
}

export function demolitionRefund(machine: Machine): number {
  return Math.floor(machine.paidCents * WORKSHOP.demolitionRefundPercent / 100);
}

/** Units held by a machine: inventory, belt, router, finished and in-progress production. */
export function contentsOf(world: World, id: number): Inventory {
  const belt = world.belts[id] ?? [];
  const held = world.routers[id]?.held;
  const production = world.production[id];
  const units = held ? [...belt, held] : belt;
  let contents = units.reduce((inventory, unit) => addItems(inventory, unit.item, 1), world.stocks[id] ?? {});
  if (production) {
    contents = mergeInventories(contents, production.output);
    if (production.batch) contents = addItems(contents, production.batch.item, 1);
  }
  return contents;
}

/** Checks a conveyor line: contiguous tiles on the map, all free, affordable as a whole. */
export function checkLine(world: World, tiles: readonly LineTile[], type: ConveyorType = 'conveyor'): BuildError | null {
  if (!machineUnlocked(world, type)) return 'locked';
  if (tiles.length === 0 || tiles.length > MAX_LINE_LENGTH) return 'invalid-line';
  const seen = new Set<string>();
  for (const [index, tile] of tiles.entries()) {
    const previous = tiles[index - 1];
    if (previous && Math.abs(previous.x - tile.x) + Math.abs(previous.y - tile.y) !== 1) return 'invalid-line';
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) return 'invalid-line';
    seen.add(key);
    const error = checkFootprint(world, { ...tile, type });
    if (error) return error;
  }
  if (world.capitalCents < lineCost(tiles.length, type)) return 'insufficient-funds';
  if (world.nextMachineId + tiles.length >= Number.MAX_SAFE_INTEGER) return 'id-limit';
  return null;
}

export function lineCost(length: number, type: ConveyorType = 'conveyor'): number {
  return MACHINES[type].costCents * length;
}

/** Price of a lot; 0 for items that cannot be bought. */
/** Volume discount in percent for a line of `lots` lots of one component. */
export function volumeDiscount(lots: number): number {
  return PURCHASE.volumeDiscounts.find(discount => lots >= discount.lots)?.percent ?? 0;
}

/** Price of a shop line, supplier rate and volume discount included, rounded down to the cent. */
export function purchaseLineCost({ item, supplier, lots }: PurchaseLine): number {
  const percent = SUPPLIERS[supplier].pricePercent * (100 - volumeDiscount(lots));
  return Math.floor((ITEMS[item].unitCostCents ?? 0) * PURCHASE.lotSize * lots * percent / 10_000);
}

export function purchaseCost(lines: readonly PurchaseLine[]): number {
  return lines.reduce((total, line) => total + purchaseLineCost(line), 0);
}

export function orderCost(item: ItemType, supplier: SupplierId = 'express'): number {
  return purchaseLineCost({ item, supplier, lots: 1 });
}

/** Units a receiving dock can still accept: capacity minus its stock and the lots it awaits. */
export function dockSpace(world: World, id: number): number {
  const reserved = world.deliveries.filter(delivery => delivery.dockId === id).length * PURCHASE.lotSize;
  return capacityOf(world.progress, world.research, 'receiving') - inventoryTotal(world.stocks[id] ?? {}) - reserved;
}

/** Validates a whole shop order for one dock: every line or none is bought. */
export function checkPurchase(world: World, id: number, lines: readonly PurchaseLine[]): CommandError | null {
  const dock = world.machines.find(machine => machine.id === id);
  if (!dock) return 'missing-machine';
  if (dock.type !== 'receiving') return 'not-a-dock';
  if (lines.length === 0) return 'empty-order';
  const orderable = orderableItems(world.progress);
  let lots = 0;
  for (const line of lines) {
    if (!Number.isSafeInteger(line.lots) || line.lots < 1 || line.lots > PURCHASE.maxLots ||
      !(line.item in ITEMS) || !(line.supplier in SUPPLIERS)) return 'invalid-order';
    if (!orderable.has(line.item)) return 'locked';
    lots += line.lots;
  }
  if (world.capitalCents < purchaseCost(lines)) return 'insufficient-funds';
  if (lots * PURCHASE.lotSize > dockSpace(world, id)) return 'dock-full';
  return null;
}

export function checkOrder(world: World, id: number, item: ItemType, supplier: SupplierId = 'express'): CommandError | null {
  return checkPurchase(world, id, [{ item, supplier, lots: 1 }]);
}

/** A model switch keeps the existing stock and cannot change a running or finished batch. */
export function checkProductModel(world: World, machine: Machine, model: ProductModel): ModelError | null {
  if (model === 'custom' && !world.design) return 'design-required';
  const recipe = recipeOf(machine.type, model, world.design);
  if (!recipe) return 'not-a-producer';
  if (!modelUnlocked(world.progress, model)) return 'locked';
  if ((machine.model ?? 'office') === model) return null;
  if (world.production[machine.id]) return 'production-busy';
  if (!fitsInputStock(recipe, world.stocks[machine.id] ?? {})) return 'incompatible-inputs';
  return null;
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: number): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export function applyCommand(world: World, command: Command): CommandResult {
  if (command.kind === 'publish-design') {
    if (!modelUnlocked(world.progress, 'custom')) return { ok: false, reason: 'locked' };
    const parsed = pcDesignSchema.safeParse(command.spec);
    if (!parsed.success) return { ok: false, reason: 'design-invalid' };
    const power = designPower(parsed.data);
    if (power.required > power.available) return { ok: false, reason: 'design-power' };
    const requirements = designParts(parsed.data);
    const orderable = orderableItems(world.progress);
    if (ITEM_TYPES.some(item => requirements[item] && !orderable.has(item))) return { ok: false, reason: 'locked' };
    if (world.sales.active?.terms.model === 'custom' || world.machines.some(machine => {
      const contents = contentsOf(world, machine.id);
      return CUSTOM_ITEMS.some(item => contents[item]);
    })) return { ok: false, reason: 'design-in-use' };
    const revision = (world.design?.revision ?? 0) + 1;
    if (!Number.isSafeInteger(revision)) return { ok: false, reason: 'id-limit' };
    const design = { revision, spec: parsed.data };
    for (const machine of world.machines) {
      if (machine.model !== 'custom') continue;
      const recipe = recipeOf(machine.type, machine.model, design);
      if (recipe && !fitsInputStock(recipe, world.stocks[machine.id] ?? {})) {
        return { ok: false, reason: 'incompatible-inputs' };
      }
    }
    return { ok: true, world: { ...world, design }, machine: null };
  }

  if (command.kind === 'start-sale') {
    if (world.sales.active) return { ok: false, reason: 'sale-in-progress' };
    if (!modelUnlocked(world.progress, command.model)) return { ok: false, reason: 'locked' };
    if (!world.machines.some(machine => machine.type === 'shipping')) return { ok: false, reason: 'no-shipping-dock' };
    const terms = saleOffer(command.model, world.design);
    if (!terms) return { ok: false, reason: 'design-required' };
    const sales = { ...world.sales, active: { terms, delivered: 0 } };
    return { ok: true, world: { ...world, sales }, machine: null };
  }

  if (command.kind === 'cancel-sale') {
    if ((world.sales.active?.delivered ?? 0) > 0) return { ok: false, reason: 'sale-already-shipped' };
    return { ok: true, world: { ...world, sales: { ...world.sales, active: null } }, machine: null };
  }

  if (command.kind === 'hire') {
    const { staff } = world;
    const candidate = staff.candidates.find(person => person.id === command.candidate);
    if (!candidate) return { ok: false, reason: 'missing-candidate' };
    if (staff.employees.length >= STAFF.maxEmployees) return { ok: false, reason: 'staff-full' };
    if (!Number.isSafeInteger(staff.nextEmployeeId + 1)) return { ok: false, reason: 'id-limit' };
    const employee: Employee = {
      id: staff.nextEmployeeId, name: candidate.name, skill: candidate.skill, salaryCents: candidate.salaryCents,
      morale: STAFF.morale.initial, machineId: null,
    };
    return {
      ok: true, machine: null,
      world: {
        ...world,
        staff: {
          ...staff,
          employees: [...staff.employees, employee],
          candidates: staff.candidates.filter(person => person !== candidate),
          nextEmployeeId: staff.nextEmployeeId + 1,
        },
      },
    };
  }

  if (command.kind === 'fire') {
    const { staff } = world;
    const employee = staff.employees.find(person => person.id === command.employee);
    if (!employee) return { ok: false, reason: 'missing-employee' };
    const cost = severance(employee);
    if (world.capitalCents < cost) return { ok: false, reason: 'insufficient-funds' };
    return {
      ok: true, machine: null,
      world: {
        ...world,
        capitalCents: world.capitalCents - cost,
        staff: { ...staff, employees: staff.employees.filter(person => person !== employee), paidCents: staff.paidCents + cost },
      },
    };
  }

  if (command.kind === 'assign') {
    const { staff } = world;
    const employee = staff.employees.find(person => person.id === command.employee);
    if (!employee) return { ok: false, reason: 'missing-employee' };
    if (command.machine !== null) {
      const target = world.machines.find(candidate => candidate.id === command.machine);
      if (!target) return { ok: false, reason: 'missing-machine' };
      if (!isStaffed(target.type)) return { ok: false, reason: 'not-staffed' };
    }
    // The previous operator of the target machine, if any, becomes free.
    const employees = staff.employees.map(person => {
      if (person === employee) return { ...person, machineId: command.machine };
      return command.machine !== null && person.machineId === command.machine ? { ...person, machineId: null } : person;
    });
    return { ok: true, machine: null, world: { ...world, staff: { ...staff, employees } } };
  }

  if (command.kind === 'select-research') {
    if (command.research !== null && !researchAvailable(world.progress, world.research, command.research)) {
      return { ok: false, reason: 'research-unavailable' };
    }
    return { ok: true, world: { ...world, research: { ...world.research, active: command.research } }, machine: null };
  }

  if (command.kind === 'upgrade') {
    const machine = world.machines.find(candidate => candidate.id === command.id);
    if (!machine) return { ok: false, reason: 'missing-machine' };
    if (machine.level === 2 || !upgradeUnlocked(world.progress, world.research, machine.type)) {
      return { ok: false, reason: 'not-upgradable' };
    }
    const cost = MK2.costCents[machine.type];
    if (world.capitalCents < cost) return { ok: false, reason: 'insufficient-funds' };
    const upgraded: Machine = { ...machine, level: 2, paidCents: machine.paidCents + cost };
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - cost,
        machines: world.machines.map(candidate => candidate.id === machine.id ? upgraded : candidate),
      },
      machine: upgraded,
    };
  }

  if (command.kind === 'select-milestone') {
    if (command.milestone !== null && !milestoneAvailable(world.progress, command.milestone)) {
      return { ok: false, reason: 'milestone-unavailable' };
    }
    return { ok: true, world: { ...world, progress: { ...world.progress, active: command.milestone } }, machine: null };
  }

  if (command.kind === 'build-line') {
    const type = command.type ?? 'conveyor';
    if (!isConveyor(type)) return { ok: false, reason: 'invalid-line' };
    const reason = checkLine(world, command.tiles, type);
    if (reason) return { ok: false, reason };
    const built: Machine[] = command.tiles.map((tile, index) => ({
      type, x: tile.x, y: tile.y, rotation: tile.rotation,
      id: world.nextMachineId + index, paidCents: MACHINES[type].costCents,
    }));
    const last = built[built.length - 1];
    if (!last) return { ok: false, reason: 'invalid-line' };
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - lineCost(built.length, type),
        nextMachineId: world.nextMachineId + built.length,
        machines: [...world.machines, ...built],
      },
      machine: last,
    };
  }

  if (command.kind === 'build') {
    const reason = checkBuild(world, command);
    if (reason) return { ok: false, reason };
    const { type, rotation, x, y } = command;
    const machine: Machine = {
      type, rotation, x, y, id: world.nextMachineId, paidCents: MACHINES[type].costCents,
    };
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - machine.paidCents,
        nextMachineId: world.nextMachineId + 1,
        machines: [...world.machines, machine],
      },
      machine,
    };
  }

  const machine = world.machines.find(candidate => candidate.id === command.id);
  if (!machine) return { ok: false, reason: 'missing-machine' };

  if (command.kind === 'set-product-model') {
    const reason = checkProductModel(world, machine, command.model);
    if (reason) return { ok: false, reason };
    if ((machine.model ?? 'office') === command.model) return { ok: true, world, machine };
    const configured = { ...machine, model: command.model };
    return {
      ok: true,
      world: { ...world, machines: world.machines.map(candidate => candidate.id === machine.id ? configured : candidate) },
      machine: configured,
    };
  }

  if (command.kind === 'configure') {
    if (machine.type !== 'splitter') return { ok: false, reason: 'not-a-splitter' };
    const rest: Machine = { type: machine.type, x: machine.x, y: machine.y, rotation: machine.rotation, id: machine.id, paidCents: machine.paidCents };
    const configured: Machine = command.filter
      ? { ...rest, filter: { item: command.filter.item, output: command.filter.output } }
      : rest;
    return {
      ok: true,
      world: { ...world, machines: world.machines.map(candidate => candidate.id === machine.id ? configured : candidate) },
      machine: configured,
    };
  }

  if (command.kind === 'order' || command.kind === 'purchase') {
    const lines = command.kind === 'purchase' ? command.lines : [{ item: command.item, supplier: command.supplier ?? 'express', lots: 1 }];
    const reason = checkPurchase(world, machine.id, lines);
    if (reason) return { ok: false, reason };
    const cost = purchaseCost(lines);
    let stock = world.stocks[machine.id] ?? {};
    let purchased = world.ledger.purchased;
    const deliveries = [...world.deliveries];
    for (const { item, supplier, lots } of lines) {
      const lead = SUPPLIERS[supplier].leadTicks;
      if (lead === 0) {
        stock = addItems(stock, item, PURCHASE.lotSize * lots);
        purchased = addItems(purchased, item, PURCHASE.lotSize * lots);
        continue;
      }
      // Each lot travels as its own delivery, so that the save format and dock reservations stay per lot.
      const dueTick = world.tick + lead;
      if (!Number.isSafeInteger(dueTick)) return { ok: false, reason: 'id-limit' };
      for (let lot = 0; lot < lots; lot++) deliveries.push({ dockId: machine.id, item, supplier, dueTick });
    }
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - cost,
        stocks: inventoryTotal(stock) > 0 ? { ...world.stocks, [machine.id]: stock } : world.stocks,
        deliveries,
        ledger: { ...world.ledger, purchased, purchaseSpentCents: world.ledger.purchaseSpentCents + cost },
      },
      machine,
    };
  }

  if (command.kind === 'demolish') {
    if (world.deliveries.some(delivery => delivery.dockId === machine.id)) {
      return { ok: false, reason: 'deliveries-pending' };
    }
    const lost = contentsOf(world, machine.id);
    return {
      ok: true,
      world: {
        ...world,
        machines: world.machines.filter(candidate => candidate.id !== machine.id),
        capitalCents: world.capitalCents + demolitionRefund(machine),
        stocks: withoutKey(world.stocks, machine.id),
        belts: withoutKey(world.belts, machine.id),
        routers: withoutKey(world.routers, machine.id),
        production: withoutKey(world.production, machine.id),
        staff: unassign(world.staff, machine.id),
        ledger: inventoryTotal(lost) === 0
          ? world.ledger
          : { ...world.ledger, discarded: mergeInventories(world.ledger.discarded, lost) },
      },
      machine,
    };
  }

  const rotated = { ...machine, rotation: turnClockwise(machine.rotation) };
  const reason = checkFootprint(world, rotated, machine.id);
  if (reason) return { ok: false, reason };

  return {
    ok: true,
    world: {
      ...world,
      machines: world.machines.map(candidate => candidate.id === machine.id ? rotated : candidate),
    },
    machine: rotated,
  };
}

function unassign(staff: StaffState, machineId: number): StaffState {
  if (!staff.employees.some(employee => employee.machineId === machineId)) return staff;
  return { ...staff, employees: staff.employees.map(employee => employee.machineId === machineId ? { ...employee, machineId: null } : employee) };
}

/** World as it should be once staffing applies: base operators for unstaffed production machines. */
export function withRequiredStaff(world: World): World {
  return staffRequired(world.progress) ? { ...world, staff: assignBaseOperators(world.staff, world.machines) } : world;
}

/** True when both worlds hold the same layout, money and units, whatever their tick. */
export function sameContents(a: World, b: World): boolean {
  return a.machines === b.machines && a.stocks === b.stocks && a.belts === b.belts && a.routers === b.routers &&
    a.production === b.production && a.progress === b.progress && a.research === b.research &&
    a.ledger === b.ledger && a.sales === b.sales && a.design === b.design && a.deliveries === b.deliveries &&
    a.staff.employees === b.staff.employees && a.staff.paidCents === b.staff.paidCents &&
    (a.deliveries.length === 0 || a.tick === b.tick) && a.capitalCents === b.capitalCents;
}
