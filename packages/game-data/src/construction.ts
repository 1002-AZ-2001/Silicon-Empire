import { z } from 'zod';

export const WORKSHOP = {
  columns: 64,
  rows: 64,
  tileSize: 32,
  initialCapitalCents: 2_500_000,
  demolitionRefundPercent: 50,
} as const;

/** Simulation clock. Speeds multiply the tick rate; 0 pauses the workshop. */
export const TIME = {
  ticksPerSecond: 20,
  speeds: [0, 1, 2, 5],
  /** Ticks run for one rendered frame at most; the rest is dropped after a long frame. */
  maxTicksPerFrame: 10,
} as const;

/**
 * Conveyor belts carry units along a tile split into `lengthUnits`.
 * Default values: 1 tile per second, 2 units per tile, 2 units per second.
 */
export const CONVEYOR = {
  lengthUnits: 20,
  speedUnitsPerTick: 1,
  spacingUnits: 10,
} as const;

/**
 * Routers move one unit at a time between conveyors, without inventory.
 * A splitter takes units from its back and hands them out in turn to its left, front and right.
 * A merger takes units in turn from its left, back and right and sends them to its front.
 */
export const ROUTER_TYPES = ['splitter', 'merger'] as const;
/** Longest conveyor line placed in one drag. */
export const MAX_LINE_LENGTH = 256;

export const MACHINE_TYPES = ['storage', 'assembler', 'tester', 'receiving', 'conveyor', 'splitter', 'merger'] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

/** Directions and port sides: 0 north, 1 east, 2 south, 3 west. */
export const DIRECTIONS = [0, 1, 2, 3] as const;
export type Direction = (typeof DIRECTIONS)[number];

const port = z.strictObject({
  kind: z.enum(['input', 'output']),
  /** Side of the footprint when the machine faces north. */
  side: z.union(DIRECTIONS.map(direction => z.literal(direction))),
  /** Tile along that side, counted from the west for north and south, from the north for east and west. */
  offset: z.int().nonnegative(),
});

/** Display names are translated in the game interface (apps/web/src/i18n). */
const machineDefinition = z.strictObject({
  width: z.int().min(1).max(WORKSHOP.columns),
  height: z.int().min(1).max(WORKSHOP.rows),
  costCents: z.int().min(1).max(WORKSHOP.initialCapitalCents),
  /** Units held in the machine inventory. 0 means no inventory. */
  capacity: z.int().nonnegative(),
  ports: z.array(port.readonly()).readonly(),
}).refine(
  machine => machine.ports.every(({ side, offset }) => offset < (side % 2 === 0 ? machine.width : machine.height)),
  'Un port est placé hors de l’emprise.',
).refine(
  machine => machine.capacity > 0 || machine.ports.length === 0,
  'Une machine sans inventaire ne peut pas avoir de port.',
);

export type PortDefinition = z.infer<typeof port>;

export const MACHINES = z.record(z.enum(MACHINE_TYPES), machineDefinition.readonly()).readonly().parse({
  storage: {
    width: 1,
    height: 1,
    costCents: 60_000,
    capacity: 40,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'output', side: 0, offset: 0 },
    ],
  },
  assembler: {
    width: 2,
    height: 2,
    costCents: 180_000,
    capacity: 0,
    ports: [],
  },
  tester: {
    width: 2,
    height: 1,
    costCents: 240_000,
    capacity: 0,
    ports: [],
  },
  receiving: {
    width: 3,
    height: 2,
    costCents: 420_000,
    capacity: 100,
    ports: [{ kind: 'output', side: 0, offset: 1 }],
  },
  conveyor: {
    width: 1,
    height: 1,
    costCents: 4_000,
    capacity: 0,
    ports: [],
  },
  splitter: {
    width: 1,
    height: 1,
    costCents: 15_000,
    capacity: 0,
    ports: [],
  },
  merger: {
    width: 1,
    height: 1,
    costCents: 15_000,
    capacity: 0,
    ports: [],
  },
} satisfies Record<MachineType, z.input<typeof machineDefinition>>);
