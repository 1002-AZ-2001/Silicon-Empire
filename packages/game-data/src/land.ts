import type { MilestoneId } from './progression';

/**
 * The land is cut into square parcels, numbered row by row (parcel = row × gridColumns + column).
 * A new workshop owns the four parcels in the north-west corner, the 64 × 64 workshop of earlier
 * versions; neighbouring parcels are bought one at a time, each costing more than the last.
 */
export const LAND = {
  parcelSize: 32,
  gridColumns: 4,
  gridRows: 4,
  initialParcels: [0, 1, 4, 5],
  firstPriceCents: 1_000_000,
  priceStepCents: 500_000,
  /** In progression, buying land opens with this milestone. Sandbox workshops can always buy. */
  requiredFrom: 'warehouse' as MilestoneId,
} as const;
