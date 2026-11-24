import { MACHINES, WORKSHOP } from '@silicon-empire/game-data';
import type { MachineType } from '@silicon-empire/game-data';

export const ROTATIONS = [0, 1, 2, 3] as const;
export type Rotation = (typeof ROTATIONS)[number];

export interface Tile {
  readonly x: number;
  readonly y: number;
}

export interface Placement extends Tile {
  readonly type: MachineType;
  readonly rotation: Rotation;
}

export interface Machine extends Placement {
  readonly id: number;
  readonly paidCents: number;
}

export interface Footprint extends Tile {
  readonly width: number;
  readonly height: number;
}

export interface World {
  readonly columns: number;
  readonly rows: number;
  readonly capitalCents: number;
  readonly nextMachineId: number;
  readonly machines: readonly Machine[];
}

export type Command =
  | ({ readonly kind: 'build' } & Placement)
  | { readonly kind: 'rotate'; readonly id: number }
  | { readonly kind: 'demolish'; readonly id: number };

type FootprintError = 'out-of-bounds' | 'occupied';
type BuildError = FootprintError | 'insufficient-funds' | 'id-limit';
export type CommandError = BuildError | 'missing-machine';

type CommandResult =
  | { readonly ok: true; readonly world: World; readonly machine: Machine }
  | { readonly ok: false; readonly reason: CommandError };

export function createWorld(): World {
  return {
    columns: WORKSHOP.columns,
    rows: WORKSHOP.rows,
    capitalCents: WORKSHOP.initialCapitalCents,
    nextMachineId: 1,
    machines: [],
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

export function machineAt(world: World, tile: Tile): Machine | undefined {
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

export function applyCommand(world: World, command: Command): CommandResult {
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

  if (command.kind === 'demolish') {
    return {
      ok: true,
      world: {
        ...world,
        machines: world.machines.filter(candidate => candidate.id !== machine.id),
        capitalCents: world.capitalCents + demolitionRefund(machine),
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

export class Simulation {
  private readonly listeners = new Set<() => void>();

  constructor(private world: World) {}

  getSnapshot = (): World => this.world;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispatch(command: Command): CommandResult {
    const result = applyCommand(this.world, command);
    if (result.ok) {
      this.world = result.world;
      this.listeners.forEach(listener => listener());
    }
    return result;
  }
}
