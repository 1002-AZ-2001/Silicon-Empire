import { LAND } from '@silicon-empire/game-data';
import type { Footprint, Tile, World } from './world';

type Land = Pick<World, 'parcels'>;

export function parcelOf(tile: Tile): number {
  return Math.floor(tile.y / LAND.parcelSize) * LAND.gridColumns + Math.floor(tile.x / LAND.parcelSize);
}

/** Tiles covered by a parcel. */
export function parcelBounds(parcel: number): Footprint {
  return {
    x: (parcel % LAND.gridColumns) * LAND.parcelSize,
    y: Math.floor(parcel / LAND.gridColumns) * LAND.parcelSize,
    width: LAND.parcelSize,
    height: LAND.parcelSize,
  };
}

export function ownsTile(land: Land, tile: Tile): boolean {
  return land.parcels.includes(parcelOf(tile));
}

export function ownsFootprint(land: Land, { x, y, width, height }: Footprint): boolean {
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) if (!ownsTile(land, { x: column, y: row })) return false;
  }
  return true;
}

function neighbours(parcel: number): number[] {
  const column = parcel % LAND.gridColumns;
  const row = Math.floor(parcel / LAND.gridColumns);
  return [
    column > 0 ? parcel - 1 : -1, column < LAND.gridColumns - 1 ? parcel + 1 : -1,
    row > 0 ? parcel - LAND.gridColumns : -1, row < LAND.gridRows - 1 ? parcel + LAND.gridColumns : -1,
  ].filter(next => next >= 0);
}

/** Price of the next parcel: each purchase costs one step more than the previous one. */
export function parcelPrice(land: Land): number {
  return LAND.firstPriceCents + LAND.priceStepCents * (land.parcels.length - LAND.initialParcels.length);
}

/** Capital spent on the parcels bought so far. */
export function landSpent(land: Land): number {
  const bought = land.parcels.length - LAND.initialParcels.length;
  return bought * LAND.firstPriceCents + LAND.priceStepCents * bought * (bought - 1) / 2;
}

/** A parcel can be bought when it is on the grid, not owned yet and next to an owned parcel. */
export function parcelForSale(land: Land, parcel: number): boolean {
  return Number.isInteger(parcel) && parcel >= 0 && parcel < LAND.gridColumns * LAND.gridRows &&
    !land.parcels.includes(parcel) && neighbours(parcel).some(next => land.parcels.includes(next));
}

/** Owned parcels form one area that contains the starting parcels. */
export function landConnected(land: Land): boolean {
  if (!LAND.initialParcels.every(parcel => land.parcels.includes(parcel))) return false;
  const reached = new Set<number>(LAND.initialParcels);
  const queue: number[] = [...LAND.initialParcels];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    for (const next of neighbours(queue[cursor] as number)) {
      if (land.parcels.includes(next) && !reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  return reached.size === land.parcels.length;
}

/** Smallest rectangle around the owned land, in tiles. */
export function ownedBounds(land: Land): Footprint {
  const boxes = land.parcels.map(parcelBounds);
  const x = Math.min(...boxes.map(box => box.x));
  const y = Math.min(...boxes.map(box => box.y));
  return {
    x, y,
    width: Math.max(...boxes.map(box => box.x + box.width)) - x,
    height: Math.max(...boxes.map(box => box.y + box.height)) - y,
  };
}
