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

/** Order of this list is the order of the construction bar. New types are appended to keep shortcuts stable. */
export const MACHINE_TYPES = [
  'storage', 'assembler', 'tester', 'receiving', 'conveyor', 'splitter', 'merger',
  'packager', 'warehouse', 'conveyor-fast', 'headquarters', 'shipping', 'lab', 'conveyor-express',
  'wall', 'door', 'sofa', 'coffee', 'desk', 'air-filter',
] as const;
export type MachineType = (typeof MACHINE_TYPES)[number];

/** Conveyor generations and their speed in belt units per tick. */
export const CONVEYOR_SPEEDS = { conveyor: 1, 'conveyor-fast': 2, 'conveyor-express': 4 } as const;
export type ConveyorType = keyof typeof CONVEYOR_SPEEDS;

export function isConveyor(type: MachineType): type is ConveyorType {
  return type in CONVEYOR_SPEEDS;
}

/** Buildings drawn as a line by dragging: conveyors and walls. */
export type LineType = ConveyorType | 'wall';

export function isLineType(type: MachineType): type is LineType {
  return isConveyor(type) || type === 'wall';
}

/** Walls and doors close rooms; furniture gives a room its purpose. None has an inventory or ports. */
export const ROOM_BOUNDARIES = ['wall', 'door'] as const;
export const FURNITURE = ['sofa', 'coffee', 'desk', 'air-filter'] as const;
export type Furniture = (typeof FURNITURE)[number];

export function isRoomBoundary(type: MachineType): boolean {
  return (ROOM_BOUNDARIES as readonly MachineType[]).includes(type);
}

export function isFurniture(type: MachineType): type is Furniture {
  return (FURNITURE as readonly MachineType[]).includes(type);
}

/** Directions and port sides: 0 north, 1 east, 2 south, 3 west. */
export const DIRECTIONS = [0, 1, 2, 3] as const;
export type Direction = (typeof DIRECTIONS)[number];

const port = z.strictObject({
  kind: z.enum(['input', 'output', 'reject']),
  /** Side of the footprint when the machine faces north. */
  side: z.union(DIRECTIONS.map(direction => z.literal(direction))),
  /** Tile along that side, counted from the west for north and south, from the north for east and west. */
  offset: z.int().nonnegative(),
});

/** Display names are translated in the game interface (apps/web/src/i18n). */
const machineDefinition = z.strictObject({
  width: z.int().min(1).max(WORKSHOP.columns),
  height: z.int().min(1).max(WORKSHOP.rows),
  costCents: z.int().nonnegative().max(WORKSHOP.initialCapitalCents),
  /** Units held in the machine inventory. 0 means no inventory. */
  capacity: z.int().nonnegative(),
  ports: z.array(port.readonly()).readonly(),
}).refine(
  machine => machine.ports.every(({ side, offset }) => offset < (side % 2 === 0 ? machine.width : machine.height)),
  'Un port est placé hors de l’emprise.',
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
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'output', side: 0, offset: 1 },
    ],
  },
  tester: {
    width: 2,
    height: 1,
    costCents: 240_000,
    capacity: 0,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'output', side: 0, offset: 1 },
      { kind: 'reject', side: 1, offset: 0 },
    ],
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
  packager: {
    width: 2,
    height: 1,
    costCents: 300_000,
    capacity: 0,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'input', side: 2, offset: 1 },
      { kind: 'output', side: 0, offset: 1 },
    ],
  },
  warehouse: {
    width: 2,
    height: 2,
    costCents: 250_000,
    capacity: 200,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'output', side: 0, offset: 1 },
    ],
  },
  'conveyor-fast': {
    width: 1,
    height: 1,
    costCents: 12_000,
    capacity: 0,
    ports: [],
  },
  /** Receives milestone deliveries. Only one per workshop; free to build. */
  headquarters: {
    width: 3,
    height: 2,
    costCents: 0,
    capacity: 0,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'input', side: 2, offset: 2 },
    ],
  },
  shipping: {
    width: 2,
    height: 2,
    costCents: 160_000,
    capacity: 0,
    ports: [{ kind: 'input', side: 2, offset: 0 }],
  },
  /** Receives the parts of the active research project. */
  lab: {
    width: 2,
    height: 2,
    costCents: 500_000,
    capacity: 0,
    ports: [
      { kind: 'input', side: 2, offset: 0 },
      { kind: 'input', side: 2, offset: 1 },
    ],
  },
  'conveyor-express': {
    width: 1,
    height: 1,
    costCents: 30_000,
    capacity: 0,
    ports: [],
  },
  wall: { width: 1, height: 1, costCents: 2_000, capacity: 0, ports: [] },
  door: { width: 1, height: 1, costCents: 15_000, capacity: 0, ports: [] },
  sofa: { width: 2, height: 1, costCents: 40_000, capacity: 0, ports: [] },
  coffee: { width: 1, height: 1, costCents: 60_000, capacity: 0, ports: [] },
  desk: { width: 2, height: 1, costCents: 80_000, capacity: 0, ports: [] },
  'air-filter': { width: 1, height: 1, costCents: 250_000, capacity: 0, ports: [] },
} satisfies Record<MachineType, z.input<typeof machineDefinition>>);
