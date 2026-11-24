import { MACHINES } from '@silicon-empire/game-data';
import { checkBuild, footprintOf } from '@silicon-empire/simulation';
import { useStore } from 'zustand';
import { MACHINE_ART } from '../art/machines';
import { ERROR_LABELS, isBuildTool } from '../game/controls';
import { DIRECTIONS, Icon, money } from './shared';
import type { Placement, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

function MachinePreview({ placement }: { placement: Placement }) {
  return (
    <div className="machine-preview">
      <img src={MACHINE_ART[placement.type]} alt="" style={{ transform: `rotate(${placement.rotation * 90}deg)` }} />
    </div>
  );
}

export function Inspector({ controls, world }: { controls: WorkshopControls; world: World }) {
  const { tool, hover, rotation, selectedId, feedback } = useStore(controls.store);
  const selected = world.machines.find(machine => machine.id === selectedId);
  const pending = isBuildTool(tool) ? { type: tool, x: hover?.x ?? 0, y: hover?.y ?? 0, rotation } : null;
  const placement = pending ?? selected;
  const previewError = pending && hover ? checkBuild(world, pending) : null;
  const previewMessage = previewError
    ? ERROR_LABELS[previewError]
    : hover ? 'Placement possible' : 'Cliquez sur une case libre pour construire.';
  const definition = placement && MACHINES[placement.type];
  const footprint = placement && footprintOf(placement);

  return (
    <aside className="inspector" aria-labelledby="inspector-heading">
      <h2 id="inspector-heading"><Icon name="target" /> Inspection</h2>

      {placement && definition && footprint ? (
        <div className="inspector-detail">
          <MachinePreview placement={placement} />
          <h3>{definition.name}</h3>
          <dl className="machine-stats">
            <div><dt>Emprise</dt><dd>{footprint.width} × {footprint.height}</dd></div>
            <div><dt>Orientation</dt><dd>{DIRECTIONS[placement.rotation]}</dd></div>
            {selected && <div><dt>Ancrage</dt><dd>{selected.x + 1}, {selected.y + 1}</dd></div>}
            <div><dt>{selected ? 'Prix payé' : 'Coût'}</dt><dd>{money(selected?.paidCents ?? definition.costCents)}</dd></div>
          </dl>
          <button className="button rotate-button" type="button" onClick={controls.rotate} aria-keyshortcuts="R">
            <Icon name="rotate" /> Pivoter <kbd>R</kbd>
          </button>
          {pending && feedback?.text !== previewMessage && (
            <p className={previewError ? 'placement-status text-error' : 'placement-status'}>
              {previewMessage}
            </p>
          )}
        </div>
      ) : (
        <div className="inspector-empty">
          <span className={tool === 'demolish' ? 'empty-symbol text-error' : 'empty-symbol'}><Icon name={tool === 'demolish' ? 'trash' : 'target'} /></span>
          <h3>{tool === 'demolish' ? 'Démolition' : 'Aucun équipement sélectionné'}</h3>
          <p>{tool === 'demolish'
            ? 'Cliquez sur un équipement pour voir son remboursement et confirmer sa démolition.'
            : 'Sélectionnez un équipement sur la grille pour voir son emprise et son orientation.'}</p>
        </div>
      )}

      {feedback && (
        <p className={`workshop-feedback ${feedback.kind === 'error' ? 'text-error' : 'text-success'}`} role="status">
          {feedback.text}
        </p>
      )}
    </aside>
  );
}
