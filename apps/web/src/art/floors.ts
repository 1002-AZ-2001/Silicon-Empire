import clean from './floors/clean.png';
import tiles from './floors/tiles.png';
import wood from './floors/wood.png';
import type { FloorType } from '@silicon-empire/game-data';

/** Painted floors; concrete is the workshop background. */
export const FLOOR_ART: Record<Exclude<FloorType, 'concrete'>, string> = { tiles, wood, clean };
