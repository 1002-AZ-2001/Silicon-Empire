import { CALENDAR, LAND, WORKSHOP } from '@silicon-empire/game-data';
import { careerDate, parcelBounds } from '@silicon-empire/simulation';
import type { World } from '@silicon-empire/simulation';
import type Phaser from 'phaser';
import asphaltArt from '../art/scenery/asphalt.png';
import grassAutumnArt from '../art/scenery/grass-autumn.png';
import grassSpringArt from '../art/scenery/grass-spring.png';
import grassSummerArt from '../art/scenery/grass-summer.png';
import grassWinterArt from '../art/scenery/grass-winter.png';
import sceneryArt from '../art/scenery/scenery.png';
import sidewalkArt from '../art/scenery/sidewalk.png';

const TILE = WORKSHOP.tileSize;

/** Tiles of scenery drawn around the land: a sidewalk, a two-lane road, then fields. */
export const RING_TILES = 8;
const SIDEWALK = 1;
/** Thickness of the factory's outer wall, in pixels. */
const FACADE = 14;
const ROAD = 2;

export const SEASONS = ['winter', 'spring', 'summer', 'autumn'] as const;
export type Season = (typeof SEASONS)[number];

/** Frames of the scenery sheet: one row of six per season, then the street furniture. */
const FRAMES_PER_SEASON = 6;
const DECOR = { tree: 0, pine: 1, bush: 2, flowers: 3, rock: 4, grass: 5 } as const;
const LAMP = SEASONS.length * FRAMES_PER_SEASON;
const BENCH = LAMP + 1;

const GRASS_ART: Record<Season, string> = {
  winter: grassWinterArt, spring: grassSpringArt, summer: grassSummerArt, autumn: grassAutumnArt,
};

/** Northern seasons: December to February is winter. */
export function seasonOfMonth(month: number): Season {
  return SEASONS[Math.floor(((month + 1) % 12) / 3)] ?? 'winter';
}

/** Season at the current date: the career calendar, or months counted from January elsewhere. */
export function seasonOf(world: World): Season {
  const career = world.progress.career;
  const month = career ? careerDate(career, world.tick).month : Math.floor(world.tick / CALENDAR.monthTicks) % 12;
  return seasonOfMonth(month);
}

/** Stable pseudo-random value of a tile, from 0 to 1. The scenery looks the same in every game. */
function noise(x: number, y: number): number {
  let value = Math.imul(x, 374_761_393) + Math.imul(y, 668_265_263);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296;
}

/** Decoration of a field tile, if any: about one tile in nine. */
function decorAt(x: number, y: number): number | null {
  const draw = noise(x, y);
  if (draw > 0.11) return null;
  if (draw < 0.035) return DECOR.tree;
  if (draw < 0.05) return DECOR.pine;
  if (draw < 0.07) return DECOR.bush;
  if (draw < 0.085) return DECOR.flowers;
  if (draw < 0.095) return DECOR.rock;
  return DECOR.grass;
}

export function preloadLandscape(scene: Phaser.Scene) {
  scene.load.spritesheet('scenery', sceneryArt, { frameWidth: TILE, frameHeight: TILE });
  for (const season of SEASONS) scene.load.image(`grass-${season}`, GRASS_ART[season]);
  scene.load.image('asphalt', asphaltArt);
  scene.load.image('sidewalk', sidewalkArt);
}

/**
 * Outdoor scenery: fields, trees and a road around the land, and fields on the parcels not owned
 * yet. A bought parcel turns into factory floor. Trees and grass follow the season.
 */
export class Landscape {
  private readonly outerGrass: Phaser.GameObjects.TileSprite;
  private readonly outerDecor: Phaser.GameObjects.Blitter;
  private readonly fields: Phaser.GameObjects.Container;
  private readonly fieldDecor: Phaser.GameObjects.Blitter;
  private readonly facade: Phaser.GameObjects.Graphics;
  private season: Season | null = null;
  private parcels: World['parcels'] | null = null;

  constructor(private readonly scene: Phaser.Scene, private readonly columns: number, private readonly rows: number) {
    const ring = RING_TILES * TILE;
    const width = columns * TILE;
    const height = rows * TILE;
    this.outerGrass = scene.add.tileSprite(-ring, -ring, width + 2 * ring, height + 2 * ring, 'grass-summer').setOrigin(0).setDepth(-3);
    // Sidewalk along the land, then the road, as four strips each.
    const strips = (offset: number, thickness: number, key: string) => {
      const outer = offset + thickness;
      scene.add.tileSprite(-outer, -outer, width + 2 * outer, thickness, key).setOrigin(0).setDepth(-2);
      scene.add.tileSprite(-outer, height + offset, width + 2 * outer, thickness, key).setOrigin(0).setDepth(-2);
      scene.add.tileSprite(-outer, -offset, thickness, height + 2 * offset, key).setOrigin(0).setDepth(-2);
      scene.add.tileSprite(width + offset, -offset, thickness, height + 2 * offset, key).setOrigin(0).setDepth(-2);
    };
    strips(0, SIDEWALK * TILE, 'sidewalk');
    strips(SIDEWALK * TILE, ROAD * TILE, 'asphalt');
    this.drawRoadMarks(width, height);
    this.outerDecor = scene.add.blitter(0, 0, 'scenery').setDepth(-1);
    this.fields = scene.add.container(0, 0).setDepth(0.3);
    this.fieldDecor = scene.add.blitter(0, 0, 'scenery').setDepth(0.35);
    this.facade = scene.add.graphics().setDepth(0.95);
  }

  /** Dashed centre line of the road and street lamps along the sidewalk. */
  private drawRoadMarks(width: number, height: number) {
    const marks = this.scene.add.graphics().setDepth(-1.9);
    const middle = (SIDEWALK + ROAD / 2) * TILE;
    marks.fillStyle(0xe8dca0, 0.8);
    for (let x = -middle; x < width + middle; x += TILE) {
      marks.fillRect(x + 8, -middle - 1, 16, 2).fillRect(x + 8, height + middle - 1, 16, 2);
    }
    for (let y = -middle; y < height + middle; y += TILE) {
      marks.fillRect(-middle - 1, y + 8, 2, 16).fillRect(width + middle - 1, y + 8, 2, 16);
    }
    const street = this.scene.add.blitter(0, 0, 'scenery').setDepth(-1.8);
    const lamp = (SIDEWALK + ROAD) * TILE;
    for (let x = 0; x < width; x += 8 * TILE) {
      street.create(x, -lamp - TILE, LAMP);
      street.create(x + 4 * TILE, height + lamp, x % (16 * TILE) === 0 ? BENCH : LAMP);
    }
    for (let y = 0; y < height; y += 8 * TILE) {
      street.create(-lamp - TILE, y, LAMP);
      street.create(width + lamp, y + 4 * TILE, LAMP);
    }
  }

  private frame(decor: number, season: Season): number {
    return SEASONS.indexOf(season) * FRAMES_PER_SEASON + decor;
  }

  /** Redraws what changed: the season of every field, and the fields of the parcels not owned. */
  update(world: World) {
    const season = seasonOf(world);
    const seasonChanged = season !== this.season;
    if (seasonChanged) {
      this.season = season;
      this.outerGrass.setTexture(`grass-${season}`);
      this.drawOuterDecor(season);
    }
    if (seasonChanged || world.parcels !== this.parcels) {
      this.parcels = world.parcels;
      this.drawFields(world.parcels, season);
    }
  }

  private drawOuterDecor(season: Season) {
    this.outerDecor.clear();
    const start = -RING_TILES;
    const fieldEdge = SIDEWALK + ROAD + 1;
    for (let y = start; y < this.rows + RING_TILES; y++) {
      for (let x = start; x < this.columns + RING_TILES; x++) {
        const outside = Math.max(-x - 1, -y - 1, x - this.columns, y - this.rows);
        if (outside < fieldEdge) continue;
        const decor = decorAt(x, y);
        if (decor !== null) this.outerDecor.create(x * TILE, y * TILE, this.frame(decor, season));
      }
    }
  }

  private drawFields(owned: readonly number[], season: Season) {
    this.fields.removeAll(true);
    this.fieldDecor.clear();
    this.facade.clear();
    for (let parcel = 0; parcel < LAND.gridColumns * LAND.gridRows; parcel++) {
      if (owned.includes(parcel)) {
        this.drawFacade(parcel, owned);
        continue;
      }
      const { x, y, width, height } = parcelBounds(parcel);
      this.fields.add(this.scene.add.tileSprite(x * TILE, y * TILE, width * TILE, height * TILE, `grass-${season}`).setOrigin(0));
      for (let row = y; row < y + height; row++) {
        for (let column = x; column < x + width; column++) {
          const decor = decorAt(column, row);
          if (decor !== null) this.fieldDecor.create(column * TILE, row * TILE, this.frame(decor, season));
        }
      }
    }
  }

  /** Outer wall of the factory: on each side of an owned parcel that faces a parcel not owned. */
  private drawFacade(parcel: number, owned: readonly number[]) {
    const { x, y, width, height } = parcelBounds(parcel);
    const column = parcel % LAND.gridColumns;
    const row = Math.floor(parcel / LAND.gridColumns);
    const neighbour = (dx: number, dy: number) => {
      const nx = column + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= LAND.gridColumns || ny >= LAND.gridRows) return null;
      return ny * LAND.gridColumns + nx;
    };
    const left = x * TILE;
    const top = y * TILE;
    const right = (x + width) * TILE;
    const bottom = (y + height) * TILE;
    // Concrete wall with a window every two tiles.
    const wall = (rx: number, ry: number, rw: number, rh: number) => {
      this.facade.fillStyle(0x4b5853, 1).fillRect(rx, ry, rw, rh);
      this.facade.fillStyle(0x8c9a92, 1).fillRect(rx, ry, rw, 2).fillRect(rx, ry, 2, rh);
      this.facade.fillStyle(0x9fd3e6, 0.9);
      const horizontal = rw > rh;
      const length = horizontal ? rw : rh;
      for (let step = TILE; step < length - TILE / 2; step += 2 * TILE) {
        if (horizontal) this.facade.fillRect(rx + step - 6, ry + 4, 12, FACADE - 8);
        else this.facade.fillRect(rx + 4, ry + step - 6, FACADE - 8, 12);
      }
    };
    const open = (dx: number, dy: number) => {
      const next = neighbour(dx, dy);
      return next !== null && !owned.includes(next);
    };
    // The wall stands on the field side, so it never covers a building.
    if (open(0, -1)) wall(left, top - FACADE, right - left, FACADE);
    if (open(0, 1)) wall(left, bottom, right - left, FACADE);
    if (open(-1, 0)) wall(left - FACADE, top, FACADE, bottom - top);
    if (open(1, 0)) wall(right, top, FACADE, bottom - top);
  }
}
