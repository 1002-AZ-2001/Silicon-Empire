import { MACHINE_TYPES, WORKSHOP } from '@silicon-empire/game-data';
import { checkBuild, fitsMap, footprintOf, machineAt } from '@silicon-empire/simulation';
import Phaser from 'phaser';
import { MACHINE_ART } from '../art/machines';
import { isBuildTool } from './controls';
import { createFloor } from './floor';
import type { Footprint, Placement, Simulation, Tile, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from './controls';

export const MIN_ZOOM = 0.38;
export const MAX_ZOOM = 2.5;
export const ZOOM_STEP = 1.25;
const MAP_MARGIN = 64;
const TILE = WORKSHOP.tileSize;
const UP = ['w', 'z', 'arrowup'];
const LEFT = ['a', 'q', 'arrowleft'];
const DOWN = ['s', 'arrowdown'];
const RIGHT = ['d', 'arrowright'];
const MOVE_KEYS = new Set([...UP, ...LEFT, ...DOWN, ...RIGHT, ' ']);

interface Point { x: number; y: number }

interface PointerGesture {
  id: number;
  start: Point;
  previous: Point;
  pan: boolean;
  click: boolean;
  moved: boolean;
}

export class WorkshopScene extends Phaser.Scene {
  private readonly canvasInput = new AbortController();
  private readonly keys = new Set<string>();
  private center: Point = { x: 0, y: 0 };
  private hoverPoint: Point | null = null;
  private gesture: PointerGesture | null = null;
  private ready = false;
  private equipment!: Phaser.GameObjects.Container;
  private outline!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;

  constructor(
    private readonly simulation: Simulation,
    private readonly controls: WorkshopControls,
    private readonly onReady: () => void,
  ) {
    super('workshop');
  }

  preload() {
    for (const type of MACHINE_TYPES) this.load.image(type, MACHINE_ART[type]);
  }

  create() {
    const world = this.simulation.getSnapshot();
    createFloor(this, world.columns, world.rows);
    this.equipment = this.add.container(0, 0).setDepth(1);
    this.ghost = this.add.image(0, 0, MACHINE_TYPES[0]).setDepth(2).setAlpha(0.55);
    this.outline = this.add.graphics().setDepth(3);
    this.ready = true;
    this.resetView();
    this.drawEquipment(world);
    this.drawPreview();

    const unsubscribeWorld = this.simulation.subscribe(() => {
      this.drawEquipment(this.simulation.getSnapshot());
      this.drawPreview();
    });
    const unsubscribeUi = this.controls.store.subscribe((state, previous) => {
      if (state.hover !== previous.hover || state.tool !== previous.tool ||
          state.rotation !== previous.rotation || state.selectedId !== previous.selectedId) {
        this.drawPreview();
      }
    });

    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize);
    this.bindCanvasInput();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.ready = false;
      this.canvasInput.abort();
      unsubscribeWorld();
      unsubscribeUi();
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize);
    });
    this.onReady();
  }

  update(_time: number, delta: number) {
    const hasKey = (keys: string[]) => Number(keys.some(key => this.keys.has(key)));
    const x = hasKey(RIGHT) - hasKey(LEFT);
    const y = hasKey(DOWN) - hasKey(UP);
    if (x === 0 && y === 0) return;
    const speed = 580 * Math.min(delta, 50) / 1000 / Math.hypot(x, y);
    this.panBy(x * speed, y * speed);
  }

  resetView() {
    if (!this.ready) return;
    const world = this.simulation.getSnapshot();
    this.center = { x: world.columns * TILE / 2, y: world.rows * TILE / 2 };
    this.cameras.main.setZoom(1);
    this.controls.store.setState({ zoom: 1 });
    this.syncCamera();
  }

  zoomBy(factor: number, point?: Point) {
    if (!this.ready) return;
    const camera = this.cameras.main;
    const anchor = point ?? { x: camera.width / 2, y: camera.height / 2 };
    const before = this.worldPoint(anchor);
    const zoom = Phaser.Math.Clamp(camera.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (zoom === camera.zoom) return;
    camera.setZoom(zoom);

    const after = this.worldPoint(anchor);
    this.center.x += before.x - after.x;
    this.center.y += before.y - after.y;
    this.controls.store.setState({ zoom });
    this.syncCamera();
  }

  private onResize = () => { this.syncCamera(); };

  private syncCamera() {
    const camera = this.cameras.main;
    const { columns, rows } = this.simulation.getSnapshot();
    const clampAxis = (coordinate: number, size: number, viewport: number) => {
      const halfMap = size * TILE / 2;
      const range = Math.max(0, halfMap + MAP_MARGIN - viewport / (2 * camera.zoom));
      return Phaser.Math.Clamp(coordinate, halfMap - range, halfMap + range);
    };
    this.center.x = clampAxis(this.center.x, columns, camera.width);
    this.center.y = clampAxis(this.center.y, rows, camera.height);
    camera.centerOn(this.center.x, this.center.y);
    this.updateAim(this.hoverPoint);
  }

  private worldPoint(point: Point): Point {
    const camera = this.cameras.main;
    return {
      x: this.center.x + (point.x - camera.width / 2) / camera.zoom,
      y: this.center.y + (point.y - camera.height / 2) / camera.zoom,
    };
  }

  private tileAt(point: Point): Tile {
    const world = this.worldPoint(point);
    return { x: Math.floor(world.x / TILE), y: Math.floor(world.y / TILE) };
  }

  private updateAim(point: Point | null) {
    this.hoverPoint = point;
    this.controls.aimAt(point ? this.tileAt(point) : null);
  }

  private panBy(x: number, y: number) {
    const zoom = this.cameras.main.zoom;
    this.center.x += x / zoom;
    this.center.y += y / zoom;
    this.syncCamera();
  }

  private canvasPoint(event: MouseEvent): Point {
    const bounds = this.game.canvas.getBoundingClientRect();
    const camera = this.cameras.main;
    return {
      x: (event.clientX - bounds.left) * camera.width / bounds.width,
      y: (event.clientY - bounds.top) * camera.height / bounds.height,
    };
  }

  private bindCanvasInput() {
    const canvas = this.game.canvas;
    const options = { signal: this.canvasInput.signal };
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'region');
    canvas.setAttribute('aria-label', 'Grille interactive de l’atelier');
    canvas.addEventListener('contextmenu', event => event.preventDefault(), options);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      const point = this.canvasPoint(event);
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
      const amount = Phaser.Math.Clamp(event.deltaY * unit, -160, 160);
      this.hoverPoint = point;
      this.zoomBy(Math.exp(-amount / 550), point);
      this.updateAim(point);
    }, { ...options, passive: false });
    canvas.addEventListener('pointerdown', event => {
      if (!event.isPrimary || this.gesture || event.button > 2) return;
      const point = this.canvasPoint(event);
      const click = event.button === 0 && !this.keys.has(' ');
      this.gesture = {
        id: event.pointerId,
        start: point,
        previous: point,
        pan: !click || event.pointerType === 'touch',
        click,
        moved: false,
      };
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      this.updateAim(point);
      event.preventDefault();
    }, options);
    canvas.addEventListener('pointermove', event => {
      if (!event.isPrimary) return;
      const point = this.canvasPoint(event);
      const gesture = this.gesture;
      if (gesture?.id === event.pointerId) {
        gesture.moved ||= Math.hypot(point.x - gesture.start.x, point.y - gesture.start.y) >= 4;
        if (gesture.pan && gesture.moved) {
          canvas.classList.add('is-dragging');
          this.hoverPoint = null;
          this.panBy(gesture.previous.x - point.x, gesture.previous.y - point.y);
          gesture.previous = point;
          return;
        }
      }
      this.updateAim(point);
    }, options);
    canvas.addEventListener('pointerup', event => {
      const gesture = this.gesture;
      if (gesture?.id !== event.pointerId) return;
      const point = this.canvasPoint(event);
      const inCanvas = point.x >= 0 && point.y >= 0 &&
        point.x < this.cameras.main.width && point.y < this.cameras.main.height;
      this.gesture = null;
      canvas.classList.remove('is-dragging');
      if (gesture.click && !gesture.moved && inCanvas) this.controls.activateTile(this.tileAt(point));
      this.updateAim(inCanvas && event.pointerType !== 'touch' ? point : null);
    }, options);
    const cancelGesture = () => {
      if (!this.gesture) return;
      this.gesture = null;
      canvas.classList.remove('is-dragging');
      this.updateAim(null);
    };
    canvas.addEventListener('pointercancel', cancelGesture, options);
    canvas.addEventListener('lostpointercapture', cancelGesture, options);
    canvas.addEventListener('pointerleave', () => { this.updateAim(null); }, options);
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      if (!MOVE_KEYS.has(key) || event.altKey || event.metaKey || event.ctrlKey) return;
      if (document.querySelector('dialog[open]')) return;
      if ((key === ' ' || key.startsWith('arrow')) && event.target !== canvas) return;
      event.preventDefault();
      this.keys.add(key);
    }, options);
    window.addEventListener('keyup', event => { this.keys.delete(event.key.toLowerCase()); }, options);
    canvas.addEventListener('blur', () => this.keys.clear(), options);
    window.addEventListener('blur', () => this.keys.clear(), options);
  }

  private positionSprite(sprite: Phaser.GameObjects.Image, placement: Placement) {
    const { x, y, width, height } = footprintOf(placement);
    sprite.setPosition((x + width / 2) * TILE, (y + height / 2) * TILE);
    sprite.setAngle(placement.rotation * 90);
  }

  private drawEquipment(world: World) {
    this.equipment.removeAll(true);
    for (const machine of world.machines) {
      const sprite = this.add.image(0, 0, machine.type);
      this.positionSprite(sprite, machine);
      this.equipment.add(sprite);
    }
  }

  private markFootprint({ x, y, width, height }: Footprint, color: number, alpha: number) {
    const left = x * TILE;
    const top = y * TILE;
    this.outline.fillStyle(color, alpha).fillRect(left, top, width * TILE, height * TILE);
    this.outline.lineStyle(1, color, 0.9).strokeRect(left + 1, top + 1, width * TILE - 2, height * TILE - 2);
  }

  private drawPreview() {
    this.outline.clear();
    this.ghost.setVisible(false);
    const world = this.simulation.getSnapshot();
    const { tool, rotation, hover, selectedId } = this.controls.store.getState();

    const selected = world.machines.find(machine => machine.id === selectedId);
    if (selected) this.markFootprint(footprintOf(selected), 0xa7e6da, 0.09);
    if (!hover) return;

    if (isBuildTool(tool)) {
      const placement = { ...hover, type: tool, rotation };
      this.ghost.setTexture(tool).setVisible(true);
      this.positionSprite(this.ghost, placement);
      const error = checkBuild(world, placement);
      this.markFootprint(footprintOf(placement), error ? 0xff8267 : 0xbde778, 0.2);
      return;
    }

    const pointed = machineAt(world, hover);
    if (pointed && pointed.id !== selectedId) {
      this.markFootprint(footprintOf(pointed), tool === 'demolish' ? 0xff8267 : 0xa7e6da, 0.15);
    } else if (!pointed && fitsMap(world, { ...hover, width: 1, height: 1 })) {
      this.markFootprint({ ...hover, width: 1, height: 1 }, 0x859c8e, 0.08);
    }
  }
}
