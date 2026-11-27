import { WORKSHOP } from '@silicon-empire/game-data';
import type Phaser from 'phaser';

/** Tiles in the repeated floor pattern: one sector, 8 × 8 tiles, marked by a cross at its corner. */
const PATTERN_TILES = 8;

/**
 * Draws the concrete floor as a repeated pattern rather than one texture for the whole land:
 * a 128 × 128 land would need a 4096 × 4096 canvas.
 */
export function createFloor(scene: Phaser.Scene, columns: number, rows: number) {
  const size = WORKSHOP.tileSize;
  const side = PATTERN_TILES * size;
  const texture = scene.textures.createCanvas('atelier-floor', side, side);
  if (!texture) throw new Error('Impossible de créer la texture de l’atelier.');

  const { context } = texture;
  const panels = ['#26312f', '#283430', '#273330', '#293531'];
  for (let y = 0; y < PATTERN_TILES; y++) {
    for (let x = 0; x < PATTERN_TILES; x++) {
      const left = x * size;
      const top = y * size;
      const grain = (x * 1259) ^ (y * 12407);
      context.fillStyle = panels[grain & 3] ?? '#26312f';
      context.fillRect(left, top, size, size);
      context.fillStyle = '#202a28';
      context.fillRect(left, top, size, 1);
      context.fillRect(left, top, 1, size);
      context.fillStyle = '#36423d';
      context.fillRect(left + 2, top + 2, 1, 1);
      context.fillRect(left + 12 + ((grain >> 2) & 7), top + 13 + ((grain >> 5) & 7), 2, 1);
    }
  }
  context.fillStyle = '#43524b';
  context.fillRect(0, 0, 1, side);
  context.fillRect(0, 0, side, 1);
  context.fillStyle = '#627066';
  context.fillRect(0, 0, 6, 1);
  context.fillRect(side - 5, 0, 5, 1);
  context.fillRect(0, 0, 1, 6);
  context.fillRect(0, side - 5, 1, 5);
  texture.refresh();

  const width = columns * size;
  const height = rows * size;
  scene.add.tileSprite(0, 0, width, height, texture.key).setOrigin(0);

  // Hazard frame around the land.
  const frame = scene.add.graphics();
  frame.fillStyle(0x747357, 1);
  frame.fillRect(0, 0, width, 2).fillRect(0, 0, 2, height).fillRect(0, height - 2, width, 2).fillRect(width - 2, 0, 2, height);
  frame.fillStyle(0xba9b51, 1);
  for (let x = 0; x < width; x += size) frame.fillRect(x + 3, 0, 6, 3).fillRect(x + 3, height - 3, 6, 3);
  for (let y = 0; y < height; y += size) frame.fillRect(0, y + 3, 3, 6).fillRect(width - 3, y + 3, 3, 6);
}
