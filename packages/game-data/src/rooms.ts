/**
 * Floors are painted under buildings. Concrete is the bare floor: painting it removes a covering.
 * Prices are per tile and are not refunded when a floor is painted over.
 */
export const FLOOR_TYPES = ['concrete', 'tiles', 'wood', 'clean'] as const;
export type FloorType = (typeof FLOOR_TYPES)[number];
export const FLOOR_COST_CENTS: Readonly<Record<FloorType, number>> = { concrete: 0, tiles: 1_000, wood: 1_500, clean: 4_000 };

/**
 * A room is an area enclosed by walls and doors that does not reach the edge of the map.
 * Its type comes from its furniture, in this order of priority: clean room, office, break room.
 */
export const ROOM_TYPES = ['clean-room', 'office', 'break-room', 'empty'] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

export const ROOMS = {
  /** Smallest and largest enclosed area counted as a room, in tiles. */
  minTiles: 4,
  maxTiles: 400,
  /** A break room needs a coffee machine; each sofa then seats this many employees. */
  seatsPerSofa: 4,
  /** Morale gained on a paid month and lost on an unpaid one when every employee has a seat. */
  restedMorale: { paid: 20, unpaid: 25 },
  /** Each desk in an office adds a candidate to the next pools, up to this many. */
  maxExtraCandidates: 3,
  /** A clean room (air filter and clean floor on every tile) divides professional rejects by this factor. */
  cleanRejectionFactor: 2,
} as const;
