import { MACHINES, MACHINE_TYPES } from '@silicon-empire/game-data';
import { useStore } from 'zustand';
import { MACHINE_ART } from '../art/machines';
import { isBuildTool } from '../game/controls';
import { Icon, money } from './shared';
import type { Tool, WorkshopControls } from '../game/controls';

const TOOLS = [
  { tool: 'inspect', label: 'Inspecter', key: 'I', icon: 'target' },
  ...MACHINE_TYPES.map((tool, index) => ({
    tool, label: MACHINES[tool].shortName, key: String(index + 1),
  })),
  { tool: 'demolish', label: 'Démolir', key: 'X', icon: 'trash' },
] as const;

export function getShortcut(key: string): Tool | undefined {
  return TOOLS.find(item => item.key.toLowerCase() === key)?.tool;
}

export function ConstructionBar({ controls }: { controls: WorkshopControls }) {
  const tool = useStore(controls.store, state => state.tool);

  return (
    <section className="construction-bar" aria-labelledby="construction-heading">
      <div className="construction-header">
        <h2 id="construction-heading">Construction</h2>
        <div className="camera-help"><Icon name="move" /> <span><kbd>ZQSD</kbd> / <kbd>WASD</kbd> ou glisser au clic droit</span><span>Molette pour zoomer</span></div>
      </div>
      <div className="tool-list" role="group" aria-label="Outils de construction">
        {TOOLS.map(item => (
          <button
            type="button"
            aria-pressed={tool === item.tool}
            className={`tool-card${item.tool === 'demolish' ? ' tool-danger' : ''}`}
            aria-keyshortcuts={item.key}
            onClick={() => controls.selectTool(item.tool)}
            key={item.tool}
          >
            <span className="tool-art">
              {'icon' in item
                ? <Icon name={item.icon} />
                : <img src={MACHINE_ART[item.tool]} alt="" />}
            </span>
            <span className="tool-label">
              <strong>{item.label}</strong>
              {isBuildTool(item.tool) && <span className="tool-cost">{money(MACHINES[item.tool].costCents)}</span>}
            </span>
            <kbd>{item.key}</kbd>
          </button>
        ))}
      </div>
    </section>
  );
}
