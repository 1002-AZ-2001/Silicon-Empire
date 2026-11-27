import { FLOOR_COST_CENTS, MACHINES, MACHINE_TYPES, POWER, isComponentMachine } from '@silicon-empire/game-data';
import { machineUnlocked } from '@silicon-empire/simulation';
import { useState } from 'react';
import { useStore } from 'zustand';
import { FLOOR_ART } from '../art/floors';
import { CABLE_ART, MACHINE_ART } from '../art/machines';
import { FLOOR_TOOLS, floorOf, isBuildTool, isCableTool } from '../game/controls';
import { useI18n } from '../i18n';
import { Icon } from './shared';
import type { World } from '@silicon-empire/simulation';
import type { MachineType } from '@silicon-empire/game-data';
import type { CableTool, FloorTool, Tool, WorkshopControls } from '../game/controls';
import type { TutorialTarget } from './Tutorial';

type ToolEntry =
  | { readonly tool: 'inspect' | 'demolish'; readonly key: string; readonly icon: 'target' | 'trash' }
  | { readonly tool: (typeof MACHINE_TYPES)[number]; readonly key: string | null }
  | { readonly tool: FloorTool | CableTool; readonly key: null };

export const TOOL_CATEGORIES = ['logistics', 'production', 'energy', 'rooms'] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/** Category of each building, and its order inside the category. */
const MACHINE_CATEGORIES: Record<ToolCategory, readonly MachineType[]> = {
  logistics: [
    'storage', 'receiving', 'conveyor', 'splitter', 'merger', 'shipping', 'warehouse', 'conveyor-fast', 'conveyor-express',
  ],
  production: [
    'capacitor-press', 'pcb-etcher', 'coil-winder', 'smt-line', 'assembler', 'tester', 'packager', 'lab', 'headquarters',
  ],
  energy: ['grid-connection', 'generator'],
  rooms: ['wall', 'door', 'sofa', 'coffee', 'desk', 'air-filter'],
};

export function categoryOf(tool: Tool): ToolCategory | null {
  if (floorOf(tool)) return 'rooms';
  if (isCableTool(tool)) return 'energy';
  return TOOL_CATEGORIES.find(category => (MACHINE_CATEGORIES[category] as readonly Tool[]).includes(tool)) ?? null;
}

/** Unlocked tools sorted by category. Number keys follow that order over buildings: 1 to 9, then 0. */
export function toolsFor(world: World): ToolEntry[] {
  const machines = TOOL_CATEGORIES.flatMap(category => MACHINE_CATEGORIES[category]).filter(type => machineUnlocked(world, type));
  const keyed = machines.map((tool, index) => ({ tool, key: index < 9 ? String(index + 1) : index === 9 ? '0' : null }));
  const extras: Record<ToolCategory, ToolEntry[]> = {
    logistics: [],
    production: [],
    // Cables come with the power sources.
    energy: machineUnlocked(world, 'grid-connection') || machineUnlocked(world, 'generator')
      ? (['cable', 'uncable'] as const).map(tool => ({ tool, key: null })) : [],
    // Floors come with walls.
    rooms: machineUnlocked(world, 'wall') ? FLOOR_TOOLS.map(tool => ({ tool, key: null })) : [],
  };
  return [
    { tool: 'inspect', key: 'I', icon: 'target' },
    ...TOOL_CATEGORIES.flatMap(category => [...keyed.filter(entry => categoryOf(entry.tool) === category), ...extras[category]]),
    { tool: 'demolish', key: 'X', icon: 'trash' },
  ];
}

export function getShortcut(world: World, key: string): Tool | undefined {
  return toolsFor(world).find(item => item.key?.toLowerCase() === key)?.tool;
}

export function ConstructionBar({ controls, world, onGuide, highlight = null }: {
  controls: WorkshopControls;
  world: World;
  onGuide: () => void;
  /** Tool the tutorial points at; `machine` is the production machine of the specialty. */
  highlight?: TutorialTarget;
}) {
  const tool = useStore(controls.store, state => state.tool);
  const { t, money } = useI18n();
  const [category, setCategory] = useState<ToolCategory | 'all'>('all');
  const available = toolsFor(world);
  const tools = available.filter(item => category === 'all' || item.tool === 'inspect' || item.tool === 'demolish' ||
    categoryOf(item.tool) === category);
  const pointed = (tool: Tool) => highlight !== null && (
    tool === highlight || (highlight === 'machine' && isBuildTool(tool) && isComponentMachine(tool) && tool !== 'smt-line')
  );
  const label = (item: ToolEntry) => {
    const floor = floorOf(item.tool);
    if (floor) return t.floors[floor];
    if (item.tool === 'cable') return t.construction.cable;
    if (item.tool === 'uncable') return t.construction.uncable;
    return item.tool === 'inspect' ? t.construction.inspect
      : item.tool === 'demolish' ? t.construction.demolish
        : isBuildTool(item.tool) ? t.machines[item.tool].short : '';
  };
  const art = (item: ToolEntry) => {
    if (isCableTool(item.tool)) return <img className={item.tool === 'uncable' ? 'cable-remove' : undefined} src={CABLE_ART} alt="" />;
    const floor = floorOf(item.tool);
    if (floor) return floor === 'concrete' ? <span className="floor-swatch" /> : <img src={FLOOR_ART[floor]} alt="" />;
    return 'icon' in item ? <Icon name={item.icon} /> : isBuildTool(item.tool) ? <img src={MACHINE_ART[item.tool]} alt="" /> : null;
  };

  return (
    <section className="construction-bar" aria-labelledby="construction-heading">
      <div className="construction-header">
        <h2 id="construction-heading">{t.construction.title}</h2>
        <div className="construction-help">
          <div className="camera-help"><Icon name="move" /> <span><kbd>ZQSD</kbd> / <kbd>WASD</kbd> {t.construction.pan}</span><span>{t.construction.zoom}</span></div>
          <button type="button" className="button" onClick={onGuide}>{t.guide.title}</button>
        </div>
      </div>
      <div className="tool-tabs" role="tablist" aria-label={t.construction.tools}>
        {(['all', ...TOOL_CATEGORIES] as const).filter(option =>
          option === 'all' || available.some(item => categoryOf(item.tool) === option)).map(option => (
          <button
            type="button"
            role="tab"
            key={option}
            aria-selected={category === option}
            className="tool-tab"
            onClick={() => setCategory(option)}
          >
            {t.construction.categories[option]}
          </button>
        ))}
      </div>
      <div className="tool-list" role="group" aria-label={t.construction.tools}>
        {tools.map(item => (
          <button
            type="button"
            aria-pressed={tool === item.tool}
            className={`tool-card${item.tool === 'demolish' ? ' tool-danger' : ''}${pointed(item.tool) ? ' tutorial-target' : ''}`}
            aria-keyshortcuts={item.key ?? undefined}
            onClick={() => controls.selectTool(item.tool)}
            key={item.tool}
          >
            <span className="tool-art">{art(item)}</span>
            <span className="tool-label">
              <strong>{label(item)}</strong>
              {isBuildTool(item.tool) && <span className="tool-cost">{money(MACHINES[item.tool].costCents)}</span>}
              {floorOf(item.tool) && <span className="tool-cost">{t.construction.perTile(money(FLOOR_COST_CENTS[floorOf(item.tool) ?? 'concrete']))}</span>}
              {item.tool === 'cable' && <span className="tool-cost">{t.construction.perTile(money(POWER.cableCostCents))}</span>}
            </span>
            {item.key && <kbd>{item.key}</kbd>}
          </button>
        ))}
      </div>
    </section>
  );
}
