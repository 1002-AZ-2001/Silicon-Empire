import { ROOMS, STAFF, isFurniture, isRoomBoundary } from '@silicon-empire/game-data';
import type { FloorType, Recipe, RoomType } from '@silicon-empire/game-data';
import { rejectionEvery } from './research';
import { operatorOf, operatorRejection } from './staff';
import { footprintOf } from './world';
import type { Machine, World } from './world';

/** Painted floors by tile index (y × columns + x). Concrete tiles are absent. */
export type Floors = Readonly<Record<string, Exclude<FloorType, 'concrete'>>>;

export interface Room {
  /** Smallest tile index of the room: stable while its walls stay in place. */
  readonly id: number;
  readonly tiles: readonly number[];
  readonly type: RoomType;
  readonly sofas: number;
  readonly coffees: number;
  readonly desks: number;
  readonly filters: number;
  /** Every tile has the clean floor. */
  readonly clean: boolean;
}

export interface RoomMap {
  readonly rooms: readonly Room[];
  /** Index in `rooms` for each tile, or -1 outside any room. */
  readonly roomOf: Int32Array;
}

function roomType(room: Omit<Room, 'type'>): RoomType {
  if (room.filters > 0 && room.clean) return 'clean-room';
  if (room.desks > 0) return 'office';
  if (room.sofas > 0 && room.coffees > 0) return 'break-room';
  return 'empty';
}

/** Tile indices covered by a machine. */
export function tilesOf(machine: Machine, columns: number): number[] {
  const { x, y, width, height } = footprintOf(machine);
  const tiles: number[] = [];
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) tiles.push(row * columns + column);
  return tiles;
}

const cache = new WeakMap<readonly Machine[], { floors: Floors; columns: number; map: RoomMap }>();

/**
 * Finds the rooms: areas closed by walls and doors that stay away from the map edge, between
 * `ROOMS.minTiles` and `ROOMS.maxTiles` tiles. Furniture counts when its whole footprint is in the room.
 * Results are cached per layout and floors.
 */
export function roomsOf(world: Pick<World, 'machines' | 'floors' | 'columns' | 'rows'>): RoomMap {
  const cached = cache.get(world.machines);
  if (cached && cached.floors === world.floors && cached.columns === world.columns) return cached.map;
  const { columns, rows } = world;
  const size = columns * rows;
  const blocked = new Uint8Array(size);
  for (const machine of world.machines) {
    if (isRoomBoundary(machine.type)) for (const tile of tilesOf(machine, columns)) blocked[tile] = 1;
  }
  const region = new Int32Array(size).fill(-1);
  const found: { tiles: number[]; open: boolean }[] = [];
  for (let start = 0; start < size; start++) {
    if (blocked[start] || region[start] !== -1) continue;
    const index = found.length;
    const tiles = [start];
    let open = false;
    region[start] = index;
    for (let cursor = 0; cursor < tiles.length; cursor++) {
      const tile = tiles[cursor] as number;
      const x = tile % columns;
      const y = Math.floor(tile / columns);
      if (x === 0 || y === 0 || x === columns - 1 || y === rows - 1) open = true;
      for (const next of [x > 0 ? tile - 1 : -1, x < columns - 1 ? tile + 1 : -1, y > 0 ? tile - columns : -1, y < rows - 1 ? tile + columns : -1]) {
        if (next < 0 || blocked[next] || region[next] !== -1) continue;
        region[next] = index;
        tiles.push(next);
      }
    }
    found.push({ tiles, open });
  }

  const counts = found.map(() => ({ sofas: 0, coffees: 0, desks: 0, filters: 0 }));
  for (const machine of world.machines) {
    if (!isFurniture(machine.type)) continue;
    const tiles = tilesOf(machine, columns);
    const first = region[tiles[0] as number] ?? -1;
    const count = counts[first];
    if (first < 0 || !count || !tiles.every(tile => region[tile] === first)) continue;
    if (machine.type === 'sofa') count.sofas += 1;
    else if (machine.type === 'coffee') count.coffees += 1;
    else if (machine.type === 'desk') count.desks += 1;
    else count.filters += 1;
  }

  const rooms: Room[] = [];
  const roomOf = new Int32Array(size).fill(-1);
  found.forEach(({ tiles, open }, index) => {
    if (open || tiles.length < ROOMS.minTiles || tiles.length > ROOMS.maxTiles) return;
    const sorted = [...tiles].sort((a, b) => a - b);
    const base = {
      id: sorted[0] as number, tiles: sorted, ...counts[index] as typeof counts[number],
      clean: sorted.every(tile => world.floors[tile] === 'clean'),
    };
    for (const tile of sorted) roomOf[tile] = rooms.length;
    rooms.push({ ...base, type: roomType(base) });
  });
  const map = { rooms, roomOf };
  cache.set(world.machines, { floors: world.floors, columns, map });
  return map;
}

/** The room containing the whole footprint of a machine, if any. */
export function roomOfMachine(world: World, machine: Machine): Room | undefined {
  const { rooms, roomOf } = roomsOf(world);
  const tiles = tilesOf(machine, world.columns);
  const index = roomOf[tiles[0] as number] ?? -1;
  return index >= 0 && tiles.every(tile => roomOf[tile] === index) ? rooms[index] : undefined;
}

/** Seats in break rooms. Every employee rests when there are at least as many seats. */
export function breakRoomSeats(world: World): number {
  return roomsOf(world).rooms.reduce((seats, room) => seats + (room.type === 'break-room' ? room.sofas * ROOMS.seatsPerSofa : 0), 0);
}

export function staffRested(world: World): boolean {
  return world.staff.employees.length > 0 && breakRoomSeats(world) >= world.staff.employees.length;
}

/** Candidates in the next pools: the base pool plus one per office desk, within the limit. */
export function poolSizeOf(world: World): number {
  const desks = roomsOf(world).rooms.reduce((total, room) => total + (room.type === 'office' ? room.desks : 0), 0);
  return Math.min(STAFF.maxPoolSize, STAFF.poolSize + Math.min(ROOMS.maxExtraCandidates, desks));
}

export function inCleanRoom(world: World, machine: Machine): boolean {
  return roomOfMachine(world, machine)?.type === 'clean-room';
}

/** Rejection rhythm of a machine: workshop research, then its operator, then a clean room. */
export function rejectionFor(world: World, machine: Machine, recipe: Recipe): number | null {
  const every = operatorRejection(rejectionEvery(world.progress, world.research, recipe), operatorOf(world.staff, machine.id)?.skill);
  return every !== null && inCleanRoom(world, machine) ? every * ROOMS.cleanRejectionFactor : every;
}
