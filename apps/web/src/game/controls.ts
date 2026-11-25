import { ITEMS, MACHINES, PURCHASE } from '@silicon-empire/game-data';
import { FixedStepClock, lineCost, machineAt, turnClockwise } from '@silicon-empire/simulation';
import { createStore } from 'zustand/vanilla';
import { money } from '../ui/shared';
import type { ItemType, MachineType } from '@silicon-empire/game-data';
import type {
  CommandError, LineTile, Rotation, RouterFilter, Simulation, Speed, Tile,
} from '@silicon-empire/simulation';

export type Tool = 'inspect' | MachineType | 'demolish';

interface Feedback {
  text: string;
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
}

export const ERROR_LABELS: Record<CommandError, string> = {
  'out-of-bounds': 'L’emprise dépasse les limites de l’atelier.',
  occupied: 'Une ou plusieurs cases sont déjà occupées.',
  'insufficient-funds': 'Capital insuffisant pour cette construction.',
  'missing-machine': 'Cet équipement a déjà été retiré.',
  'id-limit': 'Le nombre maximal de constructions a été atteint.',
  'not-a-dock': 'Seul un quai de réception peut recevoir une commande.',
  'dock-full': 'Le quai n’a pas assez de place pour un lot complet.',
  'invalid-line': 'Le tracé doit suivre des cases voisines, sans repasser sur lui-même.',
  'not-a-splitter': 'Seul un répartiteur accepte un filtre.',
};

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
    const { line } = store.getState();
    store.setState({ line: null });
    if (!line || line.length < 2) return false;
    const result = simulation.dispatch({ kind: 'build-line', tiles: line });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', text: `${line.length} convoyeurs construits pour ${money(lineCost(line.length))}.` }
        : { kind: 'error', text: ERROR_LABELS[result.reason] },
    });
    return true;
  }

  function configure(id: number, filter: RouterFilter | null) {
    const result = simulation.dispatch({ kind: 'configure', id, filter });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', text: filter ? `${ITEMS[filter.item].name} trié vers la sortie choisie.` : 'Filtre retiré.' }
        : { kind: 'error', text: ERROR_LABELS[result.reason] },
    });
  }

  function order(id: number, item: ItemType) {
    const result = simulation.dispatch({ kind: 'order', id, item });
    store.setState({
      feedback: result.ok
        ? { kind: 'success', text: `${PURCHASE.lotSize} × ${ITEMS[item].name} livrés au quai.` }
        : { kind: 'error', text: ERROR_LABELS[result.reason] },
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
          ? { kind: 'success', text: `${MACHINES[tool].name} construit.` }
          : { kind: 'error', text: ERROR_LABELS[result.reason] },
      });
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
          ? { kind: 'success', text: 'Équipement pivoté.' }
          : { kind: 'error', text: ERROR_LABELS[result.reason] },
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
        ? { kind: 'success', text: 'Équipement démoli. Remboursement crédité.' }
        : { kind: 'error', text: ERROR_LABELS[result.reason] },
    });
  }

  return {
    store, clock, setSpeed, togglePause, order, configure, startLine, extendLine, cancelLine, finishLine,
    selectTool, aimAt, activateTile, rotate, confirmDemolition,
  };
}

export type WorkshopControls = ReturnType<typeof createWorkshopControls>;
