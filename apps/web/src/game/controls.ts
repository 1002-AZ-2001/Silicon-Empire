import { MACHINES } from '@silicon-empire/game-data';
import { machineAt, turnClockwise } from '@silicon-empire/simulation';
import { createStore } from 'zustand/vanilla';
import type { MachineType } from '@silicon-empire/game-data';
import type { CommandError, Rotation, Simulation, Tile } from '@silicon-empire/simulation';

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
}

export const ERROR_LABELS: Record<CommandError, string> = {
  'out-of-bounds': 'L’emprise dépasse les limites de l’atelier.',
  occupied: 'Une ou plusieurs cases sont déjà occupées.',
  'insufficient-funds': 'Capital insuffisant pour cette construction.',
  'missing-machine': 'Cet équipement a déjà été retiré.',
  'id-limit': 'Le nombre maximal de constructions a été atteint.',
};

export function isBuildTool(tool: Tool): tool is MachineType {
  return tool !== 'inspect' && tool !== 'demolish';
}

export function createWorkshopControls(simulation: Simulation) {
  const store = createStore<WorkshopUi>(() => ({
    tool: 'inspect',
    rotation: 0,
    hover: null,
    selectedId: null,
    demolitionId: null,
    feedback: null,
    zoom: 1,
  }));

  function selectTool(tool: Tool) {
    const current = store.getState();
    store.setState({
      tool,
      rotation: tool === current.tool ? current.rotation : 0,
      selectedId: null,
      feedback: null,
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

  return { store, selectTool, aimAt, activateTile, rotate, confirmDemolition };
}

export type WorkshopControls = ReturnType<typeof createWorkshopControls>;
