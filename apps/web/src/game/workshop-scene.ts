import { CONVEYOR, ITEM_TYPES, MACHINE_TYPES, WORKSHOP } from '@silicon-empire/game-data';
import {
  checkBuild, checkLine, fitsMap, footprintOf, linksOf, machineAt, neighbour, portsOf, previewTarget,
} from '@silicon-empire/simulation';
import Phaser from 'phaser';
import { ITEM_ART } from '../art/items';
import { CONVEYOR_TURN_ART, MACHINE_ART } from '../art/machines';
import { isBuildTool } from './controls';
import { createFloor } from './floor';
import type { Direction } from '@silicon-empire/game-data';
import type { Footprint, Machine, Placement, Simulation, Tile, World, WorldPort } from '@silicon-empire/simulation';
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

const PORT_COLORS = { input: 0xbde778, output: 0xf0b24a } as const;
const itemKey = (item: string) => `item:${item}`;

/**
 * Direction in which units enter a conveyor. A conveyor fed only from one side turns:
 * units come in through that side and leave through the front.
 */
function entryDirection(world: World, conveyor: Machine): Direction {
  const feeds = linksOf(world).feeds.get(conveyor.id) ?? [];
  const [first] = feeds;
  if (first === undefined || feeds.includes(conveyor.rotation) || feeds.some(feed => feed !== first)) return conveyor.rotation;
  return first === (conveyor.rotation + 2) % 4 ? conveyor.rotation : first;
}

/** Screen position of every unit on a belt or held by a splitter or merger, by unit id. */
function unitPositions(world: World): Map<number, Point> {
  const positions = new Map<number, Point>();
  const machines = new Map(world.machines.map(machine => [String(machine.id), machine]));
  for (const [id, belt] of Object.entries(world.belts)) {
    const conveyor = machines.get(id);
    if (!conveyor) continue;
    const exit = neighbour({ x: 0, y: 0 }, conveyor.rotation);
    const entry = neighbour({ x: 0, y: 0 }, entryDirection(world, conveyor));
    for (const unit of belt) {
      // First half: from the entry edge to the centre. Second half: from the centre to the exit edge.
      const along = unit.position / CONVEYOR.lengthUnits - 0.5;
      const direction = along < 0 ? entry : exit;
      positions.set(unit.id, {
        x: (conveyor.x + 0.5 + direction.x * along) * TILE,
        y: (conveyor.y + 0.5 + direction.y * along) * TILE,
      });
    }
  }
  for (const [id, router] of Object.entries(world.routers)) {
    const machine = machines.get(id);
    if (machine && router.held) positions.set(router.held.id, { x: (machine.x + 0.5) * TILE, y: (machine.y + 0.5) * TILE });
  }
  return positions;
}

interface PointerGesture {
  id: number;
  start: Point;
  previous: Point;
  pan: boolean;
  click: boolean;
  moved: boolean;
  /** Left drag with the conveyor tool draws a line. */
  drawing: boolean;
}

export class WorkshopScene extends Phaser.Scene {
  private readonly canvasInput = new AbortController();
  private readonly keys = new Set<string>();
  private center: Point = { x: 0, y: 0 };
  private hoverPoint: Point | null = null;
  private gesture: PointerGesture | null = null;
  private ready = false;
  private equipment!: Phaser.GameObjects.Container;
  private ports!: Phaser.GameObjects.Graphics;
  private alerts!: Phaser.GameObjects.Graphics;
  private units!: Phaser.GameObjects.Container;
  private outline!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private drawnMachines: readonly Machine[] | null = null;
  private readonly unitSprites = new Map<number, Phaser.GameObjects.Image>();
  private positionCache = new WeakMap<World, Map<number, Point>>();

  constructor(
    private readonly simulation: Simulation,
    private readonly controls: WorkshopControls,
    private readonly onReady: () => void,
  ) {
    super('workshop');
  }

  preload() {
    for (const type of MACHINE_TYPES) this.load.image(type, MACHINE_ART[type]);
    for (const item of ITEM_TYPES) this.load.image(itemKey(item), ITEM_ART[item]);
    this.load.image('conveyor-turn', CONVEYOR_TURN_ART);
  }

  create() {
    const world = this.simulation.getSnapshot();
    createFloor(this, world.columns, world.rows);
    this.equipment = this.add.container(0, 0).setDepth(1);
    this.units = this.add.container(0, 0).setDepth(1.5);
    this.ports = this.add.graphics().setDepth(1.8);
    this.alerts = this.add.graphics().setDepth(1.9);
    this.ghost = this.add.image(0, 0, MACHINE_TYPES[0]).setDepth(2).setAlpha(0.55);
    this.outline = this.add.graphics().setDepth(3);
    this.ready = true;
    this.resetView();
    this.drawEquipment(world);
    this.drawPreview();

    const unsubscribeWorld = this.simulation.subscribe(cause => {
      if (cause !== 'command') return;
      this.drawEquipment(this.simulation.getSnapshot());
      this.drawPreview();
    });
    const unsubscribeUi = this.controls.store.subscribe((state, previous) => {
      if (state.hover !== previous.hover || state.tool !== previous.tool || state.line !== previous.line ||
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
    this.drawUnits();
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
      const drawing = click && event.pointerType !== 'touch' && this.controls.store.getState().tool === 'conveyor';
      this.gesture = {
        id: event.pointerId,
        start: point,
        previous: point,
        pan: !click || event.pointerType === 'touch',
        click,
        moved: false,
        drawing,
      };
      if (drawing) this.controls.startLine(this.tileAt(point));
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
        if (gesture.drawing) this.controls.extendLine(this.tileAt(point));
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
      const drewLine = gesture.drawing && this.controls.finishLine();
      if (!drewLine && gesture.click && !gesture.moved && inCanvas) this.controls.activateTile(this.tileAt(point));
      this.updateAim(inCanvas && event.pointerType !== 'touch' ? point : null);
    }, options);
    const cancelGesture = () => {
      if (!this.gesture) return;
      this.gesture = null;
      this.controls.cancelLine();
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
    if (world.machines === this.drawnMachines) return;
    this.drawnMachines = world.machines;
    this.equipment.removeAll(true);
    this.ports.clear();
    this.alerts.clear();
    const links = linksOf(world);
    for (const machine of world.machines) {
      const sprite = this.add.image(0, 0, machine.type);
      this.positionSprite(sprite, machine);
      if (machine.type === 'conveyor') {
        const entry = entryDirection(world, machine);
        // The turn sprite brings units in from the west of a north-facing belt; it is mirrored for the east.
        if (entry !== machine.rotation) sprite.setTexture('conveyor-turn').setFlipX(entry === (machine.rotation + 3) % 4);
        if (!links.conveyors.find(conveyor => conveyor.id === machine.id)?.target) this.drawDeadEnd(this.alerts, machine);
      }
      this.equipment.add(sprite);
      for (const port of portsOf(machine)) this.drawPort(this.ports, port);
    }
  }

  /** Red cross on the front edge of a conveyor that leads nowhere or faces another conveyor. */
  private drawDeadEnd(graphics: Phaser.GameObjects.Graphics, tile: Tile & { rotation: Direction }) {
    const direction = neighbour({ x: 0, y: 0 }, tile.rotation);
    const x = (tile.x + 0.5 + direction.x * 0.42) * TILE;
    const y = (tile.y + 0.5 + direction.y * 0.42) * TILE;
    graphics.fillStyle(0x101615, 0.9).fillCircle(x, y, 6);
    graphics.lineStyle(2, 0xff8267, 1).lineBetween(x - 3, y - 3, x + 3, y + 3).lineBetween(x - 3, y + 3, x + 3, y - 3);
  }

  /** Outward amber arrow for an output, inward green arrow for an input, on the edge of the port tile. */
  private drawPort(graphics: Phaser.GameObjects.Graphics, port: WorldPort) {
    const direction = neighbour({ x: 0, y: 0 }, port.side);
    const across = { x: -direction.y, y: direction.x };
    const edge = {
      x: (port.tile.x + 0.5 + direction.x / 2) * TILE,
      y: (port.tile.y + 0.5 + direction.y / 2) * TILE,
    };
    const sign = port.kind === 'output' ? 1 : -1;
    const tip = { x: edge.x + direction.x * 4 * sign, y: edge.y + direction.y * 4 * sign };
    const base = { x: edge.x - direction.x * 3 * sign, y: edge.y - direction.y * 3 * sign };
    graphics.fillStyle(0x101615, 0.85).fillCircle(edge.x, edge.y, 6);
    graphics.fillStyle(PORT_COLORS[port.kind], 1).fillTriangle(
      tip.x, tip.y,
      base.x + across.x * 4, base.y + across.y * 4,
      base.x - across.x * 4, base.y - across.y * 4,
    );
  }

  private positionsOf(world: World): Map<number, Point> {
    let positions = this.positionCache.get(world);
    if (!positions) {
      positions = unitPositions(world);
      this.positionCache.set(world, positions);
    }
    return positions;
  }

  /** Units are drawn between their previous and current tick positions. */
  private drawUnits() {
    const world = this.simulation.getSnapshot();
    const current = this.positionsOf(world);
    const previous = this.positionsOf(this.simulation.getPrevious());
    const progress = this.controls.clock.progress;
    const belts = Object.values(world.belts);

    for (const [id, sprite] of this.unitSprites) {
      if (!current.has(id)) {
        sprite.destroy();
        this.unitSprites.delete(id);
      }
    }
    for (const belt of belts) {
      for (const unit of belt) {
        const target = current.get(unit.id);
        if (!target) continue;
        const from = previous.get(unit.id) ?? target;
        let sprite = this.unitSprites.get(unit.id);
        if (!sprite) {
          sprite = this.add.image(0, 0, itemKey(unit.item));
          this.units.add(sprite);
          this.unitSprites.set(unit.id, sprite);
        }
        sprite.setPosition(from.x + (target.x - from.x) * progress, from.y + (target.y - from.y) * progress);
      }
    }
  }

  private markFootprint({ x, y, width, height }: Footprint, color: number, alpha: number) {
    const left = x * TILE;
    const top = y * TILE;
    this.outline.fillStyle(color, alpha).fillRect(left, top, width * TILE, height * TILE);
    this.outline.lineStyle(1, color, 0.9).strokeRect(left + 1, top + 1, width * TILE - 2, height * TILE - 2);
  }

  private drawLineArrow(tile: Tile & { rotation: Direction }) {
    const direction = neighbour({ x: 0, y: 0 }, tile.rotation);
    const across = { x: -direction.y, y: direction.x };
    const centre = { x: (tile.x + 0.5) * TILE, y: (tile.y + 0.5) * TILE };
    this.outline.fillStyle(0xe6eee8, 0.9).fillTriangle(
      centre.x + direction.x * 7, centre.y + direction.y * 7,
      centre.x - direction.x * 4 + across.x * 6, centre.y - direction.y * 4 + across.y * 6,
      centre.x - direction.x * 4 - across.x * 6, centre.y - direction.y * 4 - across.y * 6,
    );
  }

  private drawPreview() {
    this.outline.clear();
    this.ghost.setVisible(false);
    const world = this.simulation.getSnapshot();
    const { tool, rotation, hover, selectedId, line } = this.controls.store.getState();

    if (line) {
      const valid = checkLine(world, line) === null;
      for (const tile of line) {
        this.markFootprint({ ...tile, width: 1, height: 1 }, valid ? 0xbde778 : 0xff8267, 0.22);
        this.drawLineArrow(tile);
      }
      const last = line[line.length - 1];
      if (last && !previewTarget(world, last, last.rotation)) this.drawDeadEnd(this.outline, last);
      return;
    }

    const selected = world.machines.find(machine => machine.id === selectedId);
    if (selected) this.markFootprint(footprintOf(selected), 0xa7e6da, 0.09);
    if (!hover) return;

    if (isBuildTool(tool)) {
      const placement = { ...hover, type: tool, rotation };
      this.ghost.setTexture(tool).setVisible(true);
      this.positionSprite(this.ghost, placement);
      const error = checkBuild(world, placement);
      this.markFootprint(footprintOf(placement), error ? 0xff8267 : 0xbde778, 0.2);
      for (const port of portsOf(placement)) this.drawPort(this.outline, port);
      if (tool === 'conveyor' && !previewTarget(world, placement, rotation)) this.drawDeadEnd(this.outline, placement);
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
