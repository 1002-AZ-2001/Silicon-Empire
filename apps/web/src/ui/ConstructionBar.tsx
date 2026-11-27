import { FLOOR_COST_CENTS, MACHINES, MACHINE_TYPES } from '@silicon-empire/game-data';
import { machineUnlocked } from '@silicon-empire/simulation';
import { useStore } from 'zustand';
import { FLOOR_ART } from '../art/floors';
import { MACHINE_ART } from '../art/machines';
import { FLOOR_TOOLS, floorOf, isBuildTool } from '../game/controls';
import { useI18n } from '../i18n';
import { Icon } from './shared';
import type { World } from '@silicon-empire/simulation';
import type { FloorTool, Tool, WorkshopControls } from '../game/controls';

type ToolEntry =
  | { readonly tool: 'inspect' | 'demolish'; readonly key: string; readonly icon: 'target' | 'trash' }
  | { readonly tool: (typeof MACHINE_TYPES)[number]; readonly key: string | null }
  | { readonly tool: FloorTool; readonly key: null };

/** Unlocked tools only. Number keys follow the visible order: 1 to 9, then 0. */
export function toolsFor(world: World): ToolEntry[] {
  const machines = MACHINE_TYPES.filter(type => machineUnlocked(world, type));
  return [
    { tool: 'inspect', key: 'I', icon: 'target' },
    ...machines.map((tool, index) => ({ tool, key: index < 9 ? String(index + 1) : index === 9 ? '0' : null })),
    // Floors come with walls.
    ...machineUnlocked(world, 'wall') ? FLOOR_TOOLS.map(tool => ({ tool, key: null })) : [],
    { tool: 'demolish', key: 'X', icon: 'trash' },
  ];
}

export function getShortcut(world: World, key: string): Tool | undefined {
  return toolsFor(world).find(item => item.key?.toLowerCase() === key)?.tool;
}

export function ConstructionBar({ controls, world, onGuide }: {
  controls: WorkshopControls;
  world: World;
  onGuide: () => void;
}) {
  const tool = useStore(controls.store, state => state.tool);
  const { t, money } = useI18n();
  const tools = toolsFor(world);
  const label = (item: ToolEntry) => {
    const floor = floorOf(item.tool);
    if (floor) return t.floors[floor];
    return item.tool === 'inspect' ? t.construction.inspect
      : item.tool === 'demolish' ? t.construction.demolish
        : isBuildTool(item.tool) ? t.machines[item.tool].short : '';
  };
  const art = (item: ToolEntry) => {
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
      <div className="tool-list" role="group" aria-label={t.construction.tools}>
        {tools.map(item => (
          <button
            type="button"
            aria-pressed={tool === item.tool}
            className={`tool-card${item.tool === 'demolish' ? ' tool-danger' : ''}`}
            aria-keyshortcuts={item.key ?? undefined}
            onClick={() => controls.selectTool(item.tool)}
            key={item.tool}
          >
            <span className="tool-art">{art(item)}</span>
            <span className="tool-label">
              <strong>{label(item)}</strong>
              {isBuildTool(item.tool) && <span className="tool-cost">{money(MACHINES[item.tool].costCents)}</span>}
              {floorOf(item.tool) && <span className="tool-cost">{t.construction.perTile(money(FLOOR_COST_CENTS[floorOf(item.tool) ?? 'concrete']))}</span>}
            </span>
            {item.key && <kbd>{item.key}</kbd>}
          </button>
        ))}
      </div>
    </section>
  );
}
