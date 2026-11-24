import { CONVEYOR, MACHINES } from '@silicon-empire/game-data';
import type { Direction } from '@silicon-empire/game-data';
import { addItems, firstItem, inventoryTotal } from './inventory';
import { footprintOf } from './world';
import type { BeltItem, Machine, Placement, Tile, World } from './world';

const STEPS: readonly Tile[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

export function opposite(direction: Direction): Direction {
  return ((direction + 2) % 4) as Direction;
}

export function neighbour(tile: Tile, direction: Direction): Tile {
  const step = STEPS[direction] ?? { x: 0, y: 0 };
  return { x: tile.x + step.x, y: tile.y + step.y };
}

export interface WorldPort {
  readonly kind: 'input' | 'output';
  /** Footprint tile holding the port. */
  readonly tile: Tile;
  /** Direction the port faces, outward from the machine. */
  readonly side: Direction;
}

/** Ports of a placed machine, rotated with it. Rotation turns the footprint clockwise around its centre. */
export function portsOf(placement: Placement): WorldPort[] {
  const definition = MACHINES[placement.type];
  return definition.ports.map(port => {
    let width: number = definition.width;
    let height: number = definition.height;
    let x = port.side === 1 ? width - 1 : port.side === 3 ? 0 : port.offset;
    let y = port.side === 2 ? height - 1 : port.side === 0 ? 0 : port.offset;
    for (let turn = 0; turn < placement.rotation; turn++) {
      [x, y] = [height - 1 - y, x];
      [width, height] = [height, width];
    }
    return {
      kind: port.kind,
      tile: { x: placement.x + x, y: placement.y + y },
      side: ((port.side + placement.rotation) % 4) as Direction,
    };
  });
}

export type BeltTarget =
  | { readonly kind: 'belt'; readonly id: number }
  | { readonly kind: 'stock'; readonly id: number };

interface Links {
  /** Every conveyor in ascending id order with the place its front unit goes to. */
  readonly conveyors: readonly { readonly id: number; readonly target: BeltTarget | null }[];
  /** Connected output ports in ascending machine id, then catalogue port order. */
  readonly outputs: readonly { readonly id: number; readonly belt: number }[];
}

const linkCache = new WeakMap<readonly Machine[], Links>();

function computeLinks(world: World): Links {
  const grid = new Map<number, Machine>();
  const key = (tile: Tile) =>
    tile.x >= 0 && tile.y >= 0 && tile.x < world.columns && tile.y < world.rows ? tile.y * world.columns + tile.x : -1;
  for (const machine of world.machines) {
    const { x, y, width, height } = footprintOf(machine);
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) grid.set(row * world.columns + column, machine);
    }
  }

  const conveyors = world.machines.filter(machine => machine.type === 'conveyor').map(conveyor => {
    const next = neighbour(conveyor, conveyor.rotation);
    const receiver = grid.get(key(next));
    let target: BeltTarget | null = null;
    if (receiver?.type === 'conveyor') {
      if (receiver.rotation !== opposite(conveyor.rotation)) target = { kind: 'belt', id: receiver.id };
    } else if (receiver) {
      const entry = portsOf(receiver).find(port =>
        port.kind === 'input' && port.side === opposite(conveyor.rotation) &&
        port.tile.x === next.x && port.tile.y === next.y);
      if (entry) target = { kind: 'stock', id: receiver.id };
    }
    return { id: conveyor.id, target };
  });

  const outputs = world.machines.flatMap(machine => portsOf(machine)
    .filter(port => port.kind === 'output')
    .flatMap(port => {
      const belt = grid.get(key(neighbour(port.tile, port.side)));
      return belt?.type === 'conveyor' && belt.rotation !== opposite(port.side)
        ? [{ id: machine.id, belt: belt.id }]
        : [];
    }));

  return { conveyors, outputs };
}

export function linksOf(world: World): Links {
  let links = linkCache.get(world.machines);
  if (!links) {
    links = computeLinks(world);
    linkCache.set(world.machines, links);
  }
  return links;
}

export function stockRoom(world: Pick<World, 'machines' | 'stocks'>, id: number): number {
  const machine = world.machines.find(candidate => candidate.id === id);
  if (!machine) return 0;
  return MACHINES[machine.type].capacity - inventoryTotal(world.stocks[id] ?? {});
}

function beltHasRoom(belt: readonly BeltItem[] | undefined, entry = 0): boolean {
  const tail = belt?.[belt.length - 1];
  return !tail || tail.position - entry >= CONVEYOR.spacingUnits;
}

/**
 * Advances the workshop by one tick.
 * A unit occupies positions 0 to length - 1 on its belt. When its next move reaches the length,
 * it enters the next belt (keeping the overflow) or the stock of an input port, or waits at the end.
 * Order: conveyors in ascending id (front unit transfer, then movement), then machine outputs in ascending id.
 * A unit that changed place during the tick does not move again before the next tick.
 */
export function step(world: World): World {
  const { lengthUnits, speedUnitsPerTick, spacingUnits } = CONVEYOR;
  const links = linksOf(world);
  const arrived = new Set<number>();
  let belts = world.belts;
  let stocks = world.stocks;
  let nextItemId = world.nextItemId;

  const setBelt = (id: number, units: readonly BeltItem[]) => {
    const copy = belts === world.belts ? { ...belts } : belts as Record<string, readonly BeltItem[]>;
    if (units.length > 0) copy[id] = units;
    else delete copy[id];
    belts = copy;
  };
  const enterBelt = (id: number, unit: BeltItem) => {
    setBelt(id, [...belts[id] ?? [], unit]);
    arrived.add(unit.id);
  };
  const setStock = (id: number, change: (stock: NonNullable<World['stocks'][string]>) => World['stocks'][string]) => {
    const copy = stocks === world.stocks ? { ...stocks } : stocks as Record<string, World['stocks'][string]>;
    const next = change(copy[id] ?? {});
    if (next && inventoryTotal(next) > 0) copy[id] = next;
    else delete copy[id];
    stocks = copy;
  };

  for (const { id, target } of links.conveyors) {
    let units = belts[id];
    if (!units) continue;
    const front = units[0];
    if (front && front.position + speedUnitsPerTick >= lengthUnits && !arrived.has(front.id) && target) {
      const entry = front.position + speedUnitsPerTick - lengthUnits;
      if (target.kind === 'belt' && beltHasRoom(belts[target.id], entry)) {
        enterBelt(target.id, { ...front, position: entry });
        units = units.slice(1);
      } else if (target.kind === 'stock' && stockRoom({ machines: world.machines, stocks }, target.id) > 0) {
        setStock(target.id, stock => addItems(stock, front.item, 1));
        units = units.slice(1);
      }
    }

    let limit = lengthUnits - 1;
    let changed = units !== belts[id];
    const moved = units.map(unit => {
      if (arrived.has(unit.id)) {
        limit = unit.position - spacingUnits;
        return unit;
      }
      const position = Math.max(unit.position, Math.min(unit.position + speedUnitsPerTick, limit));
      limit = position - spacingUnits;
      if (position === unit.position) return unit;
      changed = true;
      return { ...unit, position };
    });
    if (changed) setBelt(id, moved);
  }

  for (const { id, belt } of links.outputs) {
    const item = firstItem(stocks[id] ?? {});
    if (!item || !beltHasRoom(belts[belt]) || nextItemId >= Number.MAX_SAFE_INTEGER) continue;
    setStock(id, stock => addItems(stock, item, -1));
    enterBelt(belt, { id: nextItemId, item, position: 0 });
    nextItemId += 1;
  }

  return { ...world, tick: world.tick + 1, belts, stocks, nextItemId };
}

export type BeltStatus = 'empty' | 'moving' | 'blocked';

export function beltTarget(world: World, id: number): BeltTarget | null {
  return linksOf(world).conveyors.find(conveyor => conveyor.id === id)?.target ?? null;
}

export function beltStatus(world: World, id: number): BeltStatus {
  const front = world.belts[id]?.[0];
  if (!front) return 'empty';
  const next = front.position + CONVEYOR.speedUnitsPerTick;
  if (next < CONVEYOR.lengthUnits) return 'moving';
  const target = beltTarget(world, id);
  const accepts = target?.kind === 'belt'
    ? beltHasRoom(world.belts[target.id], next - CONVEYOR.lengthUnits)
    : target?.kind === 'stock' && stockRoom(world, target.id) > 0;
  return accepts ? 'moving' : 'blocked';
}

/** Ports of a machine with whether a conveyor is attached in a compatible direction. */
export function portConnections(world: World, machine: Machine): (WorldPort & { readonly connected: boolean })[] {
  const links = linksOf(world);
  return portsOf(machine).map(port => {
    const next = neighbour(port.tile, port.side);
    const conveyor = world.machines.find(candidate =>
      candidate.type === 'conveyor' && candidate.x === next.x && candidate.y === next.y);
    const connected = port.kind === 'input'
      ? conveyor?.rotation === opposite(port.side)
      : conveyor !== undefined && links.outputs.some(output => output.id === machine.id && output.belt === conveyor.id);
    return { ...port, connected };
  });
}
