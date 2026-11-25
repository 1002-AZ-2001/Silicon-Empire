import { CONVEYOR, MACHINES } from '@silicon-empire/game-data';
import type { Direction, ItemType } from '@silicon-empire/game-data';
import { addItems, firstItem, inventoryTotal } from './inventory';
import type { Inventory } from './inventory';
import { ROUTER_SIDES, footprintOf } from './world';
import type { BeltItem, Machine, Placement, RouterState, Tile, World } from './world';

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
  | { readonly kind: 'stock'; readonly id: number }
  | { readonly kind: 'router'; readonly id: number };

/** Directions of the left, front and right sides of a router facing `rotation`. */
export function routerSides(rotation: Direction): readonly [Direction, Direction, Direction] {
  return [((rotation + 3) % 4) as Direction, rotation, ((rotation + 1) % 4) as Direction];
}

interface RouterLinks {
  readonly id: number;
  readonly type: 'splitter' | 'merger';
  /** Splitter: left, front, right. Merger: front only. Stock and belt targets only. */
  readonly outputs: readonly (BeltTarget | null)[];
  /** Feeding conveyor ids. Splitter: back only. Merger: left, back, right. */
  readonly inputs: readonly (number | null)[];
}

interface Links {
  /** Every conveyor in ascending id order with the place its front unit goes to. */
  readonly conveyors: readonly { readonly id: number; readonly target: BeltTarget | null }[];
  /** Connected output ports in ascending machine id, then catalogue port order. */
  readonly outputs: readonly { readonly id: number; readonly belt: number }[];
  /** Splitters and mergers in ascending id order. */
  readonly routers: readonly RouterLinks[];
  /** Directions in which units arrive on each conveyor, by conveyor id. */
  readonly feeds: ReadonlyMap<number, readonly Direction[]>;
}

const linkCache = new WeakMap<readonly Machine[], Links>();

function isRouter(machine: Machine | undefined): machine is Machine & { type: 'splitter' | 'merger' } {
  return machine?.type === 'splitter' || machine?.type === 'merger';
}

/** Where a unit leaving `from` towards `direction` goes, given the building on the next tile. */
function receiverOf(next: Tile, receiver: Machine | undefined, direction: Direction): BeltTarget | null {
  if (!receiver) return null;
  if (receiver.type === 'conveyor') {
    return receiver.rotation === opposite(direction) ? null : { kind: 'belt', id: receiver.id };
  }
  if (receiver.type === 'splitter') return direction === receiver.rotation ? { kind: 'router', id: receiver.id } : null;
  if (receiver.type === 'merger') {
    return direction === opposite(receiver.rotation) ? null : { kind: 'router', id: receiver.id };
  }
  const entry = portsOf(receiver).find(port =>
    port.kind === 'input' && port.side === opposite(direction) && port.tile.x === next.x && port.tile.y === next.y);
  return entry ? { kind: 'stock', id: receiver.id } : null;
}

function computeLinks(world: Pick<World, 'machines' | 'columns' | 'rows'>): Links {
  const grid = new Map<number, Machine>();
  const at = (tile: Tile) =>
    tile.x >= 0 && tile.y >= 0 && tile.x < world.columns && tile.y < world.rows
      ? grid.get(tile.y * world.columns + tile.x)
      : undefined;
  for (const machine of world.machines) {
    const { x, y, width, height } = footprintOf(machine);
    for (let row = y; row < y + height; row++) {
      for (let column = x; column < x + width; column++) grid.set(row * world.columns + column, machine);
    }
  }
  const targetFrom = (tile: Tile, direction: Direction) => {
    const next = neighbour(tile, direction);
    return receiverOf(next, at(next), direction);
  };

  const feeds = new Map<number, Direction[]>();
  const feed = (target: BeltTarget | null, direction: Direction) => {
    if (target?.kind === 'belt') feeds.set(target.id, [...feeds.get(target.id) ?? [], direction]);
  };

  const conveyors = world.machines.filter(machine => machine.type === 'conveyor').map(conveyor => {
    const target = targetFrom(conveyor, conveyor.rotation);
    feed(target, conveyor.rotation);
    return { id: conveyor.id, target };
  });

  const outputs = world.machines.flatMap(machine => portsOf(machine)
    .filter(port => port.kind === 'output')
    .flatMap(port => {
      const target = targetFrom(port.tile, port.side);
      if (target?.kind !== 'belt') return [];
      feed(target, port.side);
      return [{ id: machine.id, belt: target.id }];
    }));

  const routers = world.machines.filter(isRouter).map(router => {
    const [left, front, right] = routerSides(router.rotation);
    const outputSides = router.type === 'splitter' ? [left, front, right] : [front];
    const outputs = outputSides.map(side => {
      const target = targetFrom(router, side);
      if (target?.kind !== 'belt' && target?.kind !== 'stock') return null;
      feed(target, side);
      return target;
    });
    const inputSides = router.type === 'splitter' ? [opposite(front)] : [left, opposite(front), right];
    const inputs = inputSides.map(side => {
      const conveyor = at(neighbour(router, side));
      const link = conveyors.find(candidate => candidate.id === conveyor?.id);
      return link?.target?.kind === 'router' && link.target.id === router.id ? link.id : null;
    });
    return { id: router.id, type: router.type, outputs, inputs };
  });

  return { conveyors, outputs, routers, feeds };
}

export function linksOf(world: World): Links {
  let links = linkCache.get(world.machines);
  if (!links) {
    links = computeLinks(world);
    linkCache.set(world.machines, links);
  }
  return links;
}

/** Target of a conveyor that would be placed at `tile` facing `direction`, used to preview connections. */
export function previewTarget(world: World, tile: Tile, direction: Direction): BeltTarget | null {
  const next = neighbour(tile, direction);
  return receiverOf(next, world.machines.find(machine => {
    const { x, y, width, height } = footprintOf(machine);
    return next.x >= x && next.x < x + width && next.y >= y && next.y < y + height;
  }), direction);
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

const EMPTY_ROUTER: RouterState = { held: null, cursor: 0 };

/**
 * Advances the workshop by one tick.
 * A unit occupies positions 0 to length - 1 on its belt. When its next move reaches the length,
 * it enters the next belt (keeping the overflow) or the stock of an input port, or waits at the end.
 * Order: conveyors in ascending id (front unit transfer, then movement); then splitters and mergers
 * in ascending id (hand out the held unit, then take a waiting unit); then machine outputs in ascending id.
 * A unit that changed place during the tick does not move again before the next tick.
 */
export function step(world: World): World {
  const { lengthUnits, speedUnitsPerTick, spacingUnits } = CONVEYOR;
  const links = linksOf(world);
  const machines = new Map(world.machines.map(machine => [machine.id, machine]));
  const arrived = new Set<number>();
  let belts = world.belts;
  let stocks = world.stocks;
  let routers = world.routers;
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
  const setStock = (id: number, change: (stock: Inventory) => Inventory) => {
    const copy = stocks === world.stocks ? { ...stocks } : stocks as Record<string, Inventory>;
    const next = change(copy[id] ?? {});
    if (inventoryTotal(next) > 0) copy[id] = next;
    else delete copy[id];
    stocks = copy;
  };
  const setRouter = (id: number, state: RouterState) => {
    const copy = routers === world.routers ? { ...routers } : routers as Record<string, RouterState>;
    if (state.held || state.cursor !== 0) copy[id] = state;
    else delete copy[id];
    routers = copy;
  };
  const accepts = (target: BeltTarget | null, entry = 0) =>
    target?.kind === 'belt' ? beltHasRoom(belts[target.id], entry)
      : target?.kind === 'stock' && stockRoom({ machines: world.machines, stocks }, target.id) > 0;
  const deliver = (target: BeltTarget, unit: { id: number; item: ItemType }, entry = 0) => {
    if (target.kind === 'belt') enterBelt(target.id, { ...unit, position: entry });
    else setStock(target.id, stock => addItems(stock, unit.item, 1));
  };

  for (const { id, target } of links.conveyors) {
    let units = belts[id];
    if (!units) continue;
    const front = units[0];
    if (front && front.position + speedUnitsPerTick >= lengthUnits && !arrived.has(front.id) && target?.kind !== 'router') {
      const entry = front.position + speedUnitsPerTick - lengthUnits;
      if (target && accepts(target, entry)) {
        deliver(target, front, entry);
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

  for (const router of links.routers) {
    let { held, cursor } = routers[router.id] ?? EMPTY_ROUTER;
    if (held && !arrived.has(held.id)) {
      if (router.type === 'merger') {
        const target = router.outputs[0] ?? null;
        if (target && accepts(target)) {
          deliver(target, held);
          held = null;
        }
      } else {
        const filter = machines.get(router.id)?.filter;
        const filterIndex = filter ? ROUTER_SIDES.indexOf(filter.output) : -1;
        const filtered = filter?.item === held.item;
        for (let offset = 0; offset < 3; offset++) {
          const index = filtered ? filterIndex : (cursor + offset) % 3;
          if (!filtered && index === filterIndex) continue;
          const target = router.outputs[index] ?? null;
          if (target && accepts(target)) {
            deliver(target, held);
            held = null;
            if (!filtered) cursor = (index + 1) % 3;
            break;
          }
          if (filtered) break;
        }
      }
    }
    if (!held) {
      const count = router.inputs.length;
      for (let offset = 0; offset < count; offset++) {
        const index = (cursor + offset) % count;
        const conveyor = router.inputs[index];
        const front = conveyor === null || conveyor === undefined ? undefined : belts[conveyor]?.[0];
        if (conveyor === null || conveyor === undefined || !front || arrived.has(front.id)) continue;
        if (front.position + speedUnitsPerTick < lengthUnits) continue;
        setBelt(conveyor, (belts[conveyor] ?? []).slice(1));
        held = { id: front.id, item: front.item };
        arrived.add(front.id);
        if (router.type === 'merger') cursor = (index + 1) % count;
        break;
      }
    }
    const previous = routers[router.id] ?? EMPTY_ROUTER;
    if (held !== previous.held || cursor !== previous.cursor) setRouter(router.id, { held, cursor });
  }

  for (const { id, belt } of links.outputs) {
    const item = firstItem(stocks[id] ?? {});
    if (!item || !beltHasRoom(belts[belt]) || nextItemId >= Number.MAX_SAFE_INTEGER) continue;
    setStock(id, stock => addItems(stock, item, -1));
    enterBelt(belt, { id: nextItemId, item, position: 0 });
    nextItemId += 1;
  }

  return { ...world, tick: world.tick + 1, belts, stocks, routers, nextItemId };
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
    : target?.kind === 'stock' ? stockRoom(world, target.id) > 0
      : target?.kind === 'router' && !world.routers[target.id]?.held;
  return accepts ? 'moving' : 'blocked';
}

/** Connected outputs and inputs of a splitter or merger. */
export function routerLinks(world: World, id: number): RouterLinks | undefined {
  return linksOf(world).routers.find(router => router.id === id);
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
