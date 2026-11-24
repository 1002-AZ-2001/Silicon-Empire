import { WORKSHOP } from '@silicon-empire/game-data';
import type Phaser from 'phaser';

export function createFloor(scene: Phaser.Scene, columns: number, rows: number) {
  const size = WORKSHOP.tileSize;
  const width = columns * size;
  const height = rows * size;
  const texture = scene.textures.createCanvas('atelier-floor', width, height);
  if (!texture) throw new Error('Impossible de créer la texture de l’atelier.');

  const { context } = texture;
  const panels = ['#26312f', '#283430', '#273330', '#293531'];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
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
  const sector = size * 8;
  for (let x = sector; x < width; x += sector) context.fillRect(x, 0, 1, height);
  for (let y = sector; y < height; y += sector) context.fillRect(0, y, width, 1);

  context.fillStyle = '#627066';
  for (let y = sector; y < height; y += sector) {
    for (let x = sector; x < width; x += sector) {
      context.fillRect(x - 5, y, 11, 1);
      context.fillRect(x, y - 5, 1, 11);
    }
  }

  context.fillStyle = '#747357';
  context.fillRect(0, 0, width, 2);
  context.fillRect(0, 0, 2, height);
  context.fillRect(0, height - 2, width, 2);
  context.fillRect(width - 2, 0, 2, height);
  context.fillStyle = '#ba9b51';
  for (let x = 0; x < width; x += size) {
    context.fillRect(x + 3, 0, 6, 3);
    context.fillRect(x + 3, height - 3, 6, 3);
  }
  for (let y = 0; y < height; y += size) {
    context.fillRect(0, y + 3, 3, 6);
    context.fillRect(width - 3, y + 3, 3, 6);
  }

  texture.refresh();
  scene.add.image(0, 0, texture.key).setOrigin(0);
}
