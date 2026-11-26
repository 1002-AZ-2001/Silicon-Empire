import { PURCHASE, isConveyor } from '@silicon-empire/game-data';
import type { ConveyorType, MilestoneId, ProductModel } from '@silicon-empire/game-data';
import { FixedStepClock, lineCost, machineAt, turnClockwise } from '@silicon-empire/simulation';
import { createStore } from 'zustand/vanilla';
import type { Messages, Translator } from '../i18n';
import type { ItemType, MachineType } from '@silicon-empire/game-data';
import type {
  LineTile, Rotation, RouterFilter, Simulation, Speed, Tile,
} from '@silicon-empire/simulation';

export type Tool = 'inspect' | MachineType | 'demolish';

interface Feedback {
  /** Built when displayed, so the message follows the current language. */
  message: (translator: Translator) => string;
  kind: 'success' | 'error';
}

interface WorkshopUi {
  tool: Tool;
  rotation: Rotation;
  hover: Tile | null;
  selectedId: number | null;
  demolitionId: number | null;
  feedback: Feedback | null;
  zoom: number;
  speed: Speed;
  /** Conveyor line being drawn, in drawing order. */
  line: LineTile[] | null;
  progressionOpen: boolean;
  salesOpen: boolean;
}


function errorMessage(reason: keyof Messages['errors']): Feedback['message'] {
  return ({ t }) => t.errors[reason];
}

/** Direction from one tile to a neighbouring tile. */
function directionTo(from: Tile, to: Tile): Rotation {
  if (to.x > from.x) return 1;
  if (to.x < from.x) return 3;
  return to.y > from.y ? 2 : 0;
}

/** Points the line along the drawn path; the last tile keeps the direction of the last step. */
function orient(path: readonly Tile[], fallback: Rotation): LineTile[] {
  return path.map((tile, index) => {
    const next = path[index + 1];
    const previous = path[index - 1];
    const rotation = next ? directionTo(tile, next) : previous ? directionTo(previous, tile) : fallback;
    return { x: tile.x, y: tile.y, rotation };
  });
}

export function isBuildTool(tool: Tool): tool is MachineType {
  return tool !== 'inspect' && tool !== 'demolish';
}

export function createWorkshopControls(simulation: Simulation, initialSpeed: Speed = 1) {
  const store = createStore<WorkshopUi>(() => ({
    tool: 'inspect',
    rotation: 0,
    hover: null,
    selectedId: null,
    demolitionId: null,
    feedback: null,
    zoom: 1,
    speed: initialSpeed,
    line: null,
    progressionOpen: false,
    salesOpen: false,
  }));
  const clock = new FixedStepClock();
  clock.speed = initialSpeed;
  let resumeSpeed: Speed = initialSpeed === 0 ? 1 : initialSpeed;

  function setSpeed(speed: Speed) {
    if (speed !== 0) resumeSpeed = speed;
    clock.speed = speed;
    store.setState({ speed });
  }

  function togglePause() {
    setSpeed(clock.speed === 0 ? resumeSpeed : 0);
  }

  function startLine(tile: Tile) {
    store.setState({ line: orient([tile], store.getState().rotation) });
  }

  /** Extends the line to the pointed tile, through horizontal then vertical steps. Going back erases. */
  function extendLine(tile: Tile) {
    const { line, rotation } = store.getState();
    const last = line?.[line.length - 1];
    if (!line || !last || (last.x === tile.x && last.y === tile.y)) return;
    const path: Tile[] = line.map(({ x, y }) => ({ x, y }));
    let cursor: Tile = last;
    while (cursor.x !== tile.x || cursor.y !== tile.y) {
      cursor = cursor.x !== tile.x
        ? { x: cursor.x + Math.sign(tile.x - cursor.x), y: cursor.y }
        : { x: cursor.x, y: cursor.y + Math.sign(tile.y - cursor.y) };
      const visited = path.findIndex(step => step.x === cursor.x && step.y === cursor.y);
      if (visited >= 0) path.splice(visited + 1);
      else path.push(cursor);
    }
    store.setState({ line: orient(path, rotation) });
  }

  function cancelLine() {
    if (store.getState().line) store.setState({ line: null });
  }

  /** Builds the drawn line in one command. Returns false when the line has a single tile. */
  function finishLine(): boolean {
    const { line, tool } = store.getState();
    store.setState({ line: null });
    if (!line || line.length < 2) return false;
    const type: ConveyorType = isBuildTool(tool) && isConveyor(tool) ? tool : 'conveyor';
    const result = simulation.dispatch({ kind: 'build-line', tiles: line, type });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t, money }) => t.feedback.lineBuilt(line.length, money(lineCost(line.length, type))) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
    return true;
  }

  function selectMilestone(milestone: MilestoneId | null) {
    const result = simulation.dispatch({ kind: 'select-milestone', milestone });
    if (!result.ok) store.setState({ feedback: { kind: 'error', message: errorMessage(result.reason) } });
  }

  function setProductModel(id: number, model: ProductModel) {
    const result = simulation.dispatch({ kind: 'set-product-model', id, model });
    store.setState({ feedback: result.ok ? null : { kind: 'error', message: errorMessage(result.reason) } });
  }

  function changeSale(model?: ProductModel) {
    const result = simulation.dispatch(model ? { kind: 'start-sale', model } : { kind: 'cancel-sale' });
    if (!result.ok) store.setState({ feedback: { kind: 'error', message: errorMessage(result.reason) } });
  }

  function configure(id: number, filter: RouterFilter | null) {
    const result = simulation.dispatch({ kind: 'configure', id, filter });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => filter ? t.feedback.filterSet(t.items[filter.item]) : t.feedback.filterCleared }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function order(id: number, item: ItemType) {
    const result = simulation.dispatch({ kind: 'order', id, item });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.delivered(PURCHASE.lotSize, t.items[item]) }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  function selectTool(tool: Tool) {
    const current = store.getState();
    store.setState({
      tool,
      rotation: tool === current.tool ? current.rotation : 0,
      selectedId: null,
      feedback: null,
      line: null,
    });
  }

  function aimAt(hover: Tile | null) {
    const current = store.getState().hover;
    if (current?.x === hover?.x && current?.y === hover?.y) return;
    store.setState({ hover });
  }

  function activateTile(tile: Tile) {
    const { tool, rotation } = store.getState();
    if (isBuildTool(tool)) {
      const result = simulation.dispatch({ kind: 'build', type: tool, ...tile, rotation });
      store.setState({
        feedback: result.ok
          ? { kind: 'success', message: ({ t }) => t.feedback.built(t.machines[tool].name) }
          : { kind: 'error', message: errorMessage(result.reason) },
      });
      // The headquarters is unique: once placed, show it in the inspector.
      if (result.ok && tool === 'headquarters' && result.machine) {
        store.setState({ tool: 'inspect', selectedId: result.machine.id, rotation: 0 });
      }
      return;
    }

    const id = machineAt(simulation.getSnapshot(), tile)?.id ?? null;
    store.setState(tool === 'demolish'
      ? { demolitionId: id, feedback: null }
      : { selectedId: id, feedback: null });
  }

  function rotate() {
    const { tool, selectedId, rotation } = store.getState();
    if (isBuildTool(tool)) {
      store.setState({ rotation: turnClockwise(rotation), feedback: null });
    } else if (tool === 'inspect' && selectedId !== null) {
      const result = simulation.dispatch({ kind: 'rotate', id: selectedId });
      store.setState({
        feedback: result.ok
          ? { kind: 'success', message: ({ t }) => t.feedback.rotated }
          : { kind: 'error', message: errorMessage(result.reason) },
      });
    }
  }

  function confirmDemolition() {
    const { demolitionId } = store.getState();
    if (demolitionId === null) return;

    const result = simulation.dispatch({ kind: 'demolish', id: demolitionId });
    store.setState({
      demolitionId: null,
      feedback: result.ok
        ? { kind: 'success', message: ({ t }) => t.feedback.demolished }
        : { kind: 'error', message: errorMessage(result.reason) },
    });
  }

  return {
    store, clock, setSpeed, togglePause, order, configure, selectMilestone, setProductModel,
    startSale: (model: ProductModel) => changeSale(model), cancelSale: () => changeSale(),
    startLine, extendLine, cancelLine, finishLine,
    selectTool, aimAt, activateTile, rotate, confirmDemolition,
  };
}

export type WorkshopControls = ReturnType<typeof createWorkshopControls>;
