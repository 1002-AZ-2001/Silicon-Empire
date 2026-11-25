import { ITEMS, MACHINES, MAX_LINE_LENGTH, PURCHASE, WORKSHOP } from '@silicon-empire/game-data';
import type { Direction, ItemType, MachineType } from '@silicon-empire/game-data';
import { addItems, inventoryTotal, mergeInventories } from './inventory';
import type { Inventory } from './inventory';

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

/** Every unit bought is either in a stock, on a belt or explicitly discarded. */
export interface Ledger {
  readonly purchased: Inventory;
  readonly discarded: Inventory;
  readonly purchaseSpentCents: number;
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
  readonly ledger: Ledger;
}

/** One tile of a conveyor line; the direction is the rotation. */
export interface LineTile extends Tile {
  readonly rotation: Rotation;
}

export type Command =
  | ({ readonly kind: 'build' } & Placement)
  | { readonly kind: 'build-line'; readonly tiles: readonly LineTile[] }
  | { readonly kind: 'configure'; readonly id: number; readonly filter: RouterFilter | null }
  | { readonly kind: 'rotate'; readonly id: number }
  | { readonly kind: 'demolish'; readonly id: number }
  | { readonly kind: 'order'; readonly id: number; readonly item: ItemType };

type FootprintError = 'out-of-bounds' | 'occupied';
type BuildError = FootprintError | 'insufficient-funds' | 'id-limit' | 'invalid-line';
type OrderError = 'not-a-dock' | 'insufficient-funds' | 'dock-full' | 'id-limit';
export type CommandError = BuildError | OrderError | 'missing-machine' | 'not-a-splitter';

export type CommandResult =
  | { readonly ok: true; readonly world: World; readonly machine: Machine }
  | { readonly ok: false; readonly reason: CommandError };

export function createWorld(): World {
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
    ledger: { purchased: {}, discarded: {}, purchaseSpentCents: 0 },
  };
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
  const footprintError = checkFootprint(world, placement);
  if (footprintError) return footprintError;
  if (world.capitalCents < MACHINES[placement.type].costCents) return 'insufficient-funds';
  if (world.nextMachineId >= Number.MAX_SAFE_INTEGER) return 'id-limit';
  return null;
}

export function demolitionRefund(machine: Machine): number {
  return Math.floor(machine.paidCents * WORKSHOP.demolitionRefundPercent / 100);
}

/** Units held by a machine: its inventory and, for a conveyor, the units on its belt. */
export function contentsOf(world: World, id: number): Inventory {
  const belt = world.belts[id] ?? [];
  const held = world.routers[id]?.held;
  const units = held ? [...belt, held] : belt;
  return units.reduce((inventory, unit) => addItems(inventory, unit.item, 1), world.stocks[id] ?? {});
}

/** Checks a conveyor line: contiguous tiles on the map, all free, affordable as a whole. */
export function checkLine(world: World, tiles: readonly LineTile[]): BuildError | null {
  if (tiles.length === 0 || tiles.length > MAX_LINE_LENGTH) return 'invalid-line';
  const seen = new Set<string>();
  for (const [index, tile] of tiles.entries()) {
    const previous = tiles[index - 1];
    if (previous && Math.abs(previous.x - tile.x) + Math.abs(previous.y - tile.y) !== 1) return 'invalid-line';
    const key = `${tile.x},${tile.y}`;
    if (seen.has(key)) return 'invalid-line';
    seen.add(key);
    const error = checkFootprint(world, { ...tile, type: 'conveyor' });
    if (error) return error;
  }
  if (world.capitalCents < lineCost(tiles.length)) return 'insufficient-funds';
  if (world.nextMachineId + tiles.length >= Number.MAX_SAFE_INTEGER) return 'id-limit';
  return null;
}

export function lineCost(length: number): number {
  return MACHINES.conveyor.costCents * length;
}

export function orderCost(item: ItemType): number {
  return ITEMS[item].unitCostCents * PURCHASE.lotSize;
}

export function checkOrder(world: World, id: number, item: ItemType): CommandError | null {
  const dock = world.machines.find(machine => machine.id === id);
  if (!dock) return 'missing-machine';
  if (dock.type !== 'receiving') return 'not-a-dock';
  if (world.capitalCents < orderCost(item)) return 'insufficient-funds';
  if (inventoryTotal(world.stocks[id] ?? {}) + PURCHASE.lotSize > MACHINES.receiving.capacity) return 'dock-full';
  return null;
}

function withoutKey<T>(record: Readonly<Record<string, T>>, key: number): Readonly<Record<string, T>> {
  if (!(key in record)) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export function applyCommand(world: World, command: Command): CommandResult {
  if (command.kind === 'build-line') {
    const reason = checkLine(world, command.tiles);
    if (reason) return { ok: false, reason };
    const built: Machine[] = command.tiles.map((tile, index) => ({
      type: 'conveyor', x: tile.x, y: tile.y, rotation: tile.rotation,
      id: world.nextMachineId + index, paidCents: MACHINES.conveyor.costCents,
    }));
    const last = built[built.length - 1];
    if (!last) return { ok: false, reason: 'invalid-line' };
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - lineCost(built.length),
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

  if (command.kind === 'order') {
    const reason = checkOrder(world, machine.id, command.item);
    if (reason) return { ok: false, reason };
    const cost = orderCost(command.item);
    return {
      ok: true,
      world: {
        ...world,
        capitalCents: world.capitalCents - cost,
        stocks: { ...world.stocks, [machine.id]: addItems(world.stocks[machine.id] ?? {}, command.item, PURCHASE.lotSize) },
        ledger: {
          ...world.ledger,
          purchased: addItems(world.ledger.purchased, command.item, PURCHASE.lotSize),
          purchaseSpentCents: world.ledger.purchaseSpentCents + cost,
        },
      },
      machine,
    };
  }

  if (command.kind === 'demolish') {
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

/** True when both worlds hold the same layout, money and units, whatever their tick. */
export function sameContents(a: World, b: World): boolean {
  return a.machines === b.machines && a.stocks === b.stocks && a.belts === b.belts && a.routers === b.routers &&
    a.ledger === b.ledger && a.capitalCents === b.capitalCents;
}
