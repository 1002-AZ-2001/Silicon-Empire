import { CONVEYOR, ITEMS, ITEM_TYPES, MACHINES, PURCHASE } from '@silicon-empire/game-data';
import {
  beltStatus, beltTarget, checkBuild, checkOrder, footprintOf, inventoryTotal, orderCost, portConnections, portsOf,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { useStore } from 'zustand';
import { ITEM_ART } from '../art/items';
import { MACHINE_ART } from '../art/machines';
import { ERROR_LABELS, isBuildTool } from '../game/controls';
import { DIRECTIONS, Icon, money } from './shared';
import type { ItemType } from '@silicon-empire/game-data';
import type { BeltStatus, Inventory, Machine, Placement, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

const BELT_STATUS: Record<BeltStatus, string> = {
  empty: 'Vide',
  moving: 'En mouvement',
  blocked: 'Saturé',
};

const UNITS_PER_BELT = Math.ceil(CONVEYOR.lengthUnits / CONVEYOR.spacingUnits);

function MachinePreview({ placement }: { placement: Placement }) {
  return (
    <div className="machine-preview">
      <img src={MACHINE_ART[placement.type]} alt="" style={{ transform: `rotate(${placement.rotation * 90}deg)` }} />
    </div>
  );
}

function StockList({ stock, label }: { stock: Inventory; label: string }) {
  const lines = ITEM_TYPES.filter(item => (stock[item] ?? 0) > 0);
  if (lines.length === 0) return null;
  return (
    <ul className="stock-list" aria-label={label}>
      {lines.map(item => (
        <li key={item}>
          <img src={ITEM_ART[item]} alt="" />
          <span>{ITEMS[item].name}</span>
          <strong>{stock[item]}</strong>
        </li>
      ))}
    </ul>
  );
}

function OrderForm({ controls, world, dock }: { controls: WorkshopControls; world: World; dock: Machine }) {
  const [item, setItem] = useState<ItemType>(ITEM_TYPES[0]);
  const error = checkOrder(world, dock.id, item);
  return (
    <form
      className="order-form"
      onSubmit={event => {
        event.preventDefault();
        controls.order(dock.id, item);
      }}
    >
      <h4>Commande fournisseur</h4>
      <label>
        <span>Composant</span>
        <select value={item} onChange={event => setItem(event.target.value as ItemType)}>
          {ITEM_TYPES.map(option => (
            <option key={option} value={option}>{ITEMS[option].name} · {ITEMS[option].manufacturer}</option>
          ))}
        </select>
      </label>
      <button className="button button-primary" type="submit" disabled={error !== null}>
        Commander {PURCHASE.lotSize} unités · {money(orderCost(item))}
      </button>
      {error && <p className="order-hint text-error">{ERROR_LABELS[error]}</p>}
    </form>
  );
}

function Logistics({ world, machine }: { world: World; machine: Machine }) {
  const definition = MACHINES[machine.type];
  if (machine.type === 'conveyor') {
    const belt = world.belts[machine.id] ?? [];
    const target = beltTarget(world, machine.id);
    const receiver = target && world.machines.find(candidate => candidate.id === target.id);
    const onBelt = belt.reduce<Record<string, number>>((count, unit) => ({ ...count, [unit.item]: (count[unit.item] ?? 0) + 1 }), {});
    return (
      <>
        <dl className="machine-stats logistics-stats">
          <div><dt>Charge</dt><dd>{belt.length} / {UNITS_PER_BELT}</dd></div>
          <div><dt>État</dt><dd>{BELT_STATUS[beltStatus(world, machine.id)]}</dd></div>
          <div><dt>Destination</dt><dd>{receiver ? MACHINES[receiver.type].name : 'Non raccordée'}</dd></div>
        </dl>
        <StockList stock={onBelt} label="Unités sur le convoyeur" />
      </>
    );
  }
  if (definition.capacity === 0) return null;

  const stock = world.stocks[machine.id] ?? {};
  return (
    <>
      <dl className="machine-stats logistics-stats">
        <div><dt>Stock</dt><dd aria-label="Stock">{inventoryTotal(stock)} / {definition.capacity}</dd></div>
        {portConnections(world, machine).map((port, index) => (
          <div key={index}>
            <dt>{port.kind === 'input' ? 'Entrée' : 'Sortie'}</dt>
            <dd>{DIRECTIONS[port.side]} · {port.connected ? 'raccordée' : 'libre'}</dd>
          </div>
        ))}
      </dl>
      <StockList stock={stock} label="Contenu du stock" />
    </>
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
            <div><dt>{placement.type === 'conveyor' ? 'Sens' : 'Orientation'}</dt><dd>{DIRECTIONS[placement.rotation]}</dd></div>
            {selected && <div><dt>Ancrage</dt><dd>{selected.x + 1}, {selected.y + 1}</dd></div>}
            <div><dt>{selected ? 'Prix payé' : 'Coût'}</dt><dd>{money(selected?.paidCents ?? definition.costCents)}</dd></div>
            {pending && definition.capacity > 0 && <div><dt>Capacité</dt><dd>{definition.capacity} unités</dd></div>}
            {pending && portsOf(pending).map((port, index) => (
              <div key={index}>
                <dt>{port.kind === 'input' ? 'Entrée' : 'Sortie'}</dt>
                <dd>{DIRECTIONS[port.side]}</dd>
              </div>
            ))}
          </dl>
          <button className="button rotate-button" type="button" onClick={controls.rotate} aria-keyshortcuts="R">
            <Icon name="rotate" /> Pivoter <kbd>R</kbd>
          </button>
          {pending && feedback?.text !== previewMessage && (
            <p className={previewError ? 'placement-status text-error' : 'placement-status'}>
              {previewMessage}
            </p>
          )}
          {selected && <Logistics world={world} machine={selected} />}
          {selected?.type === 'receiving' && <OrderForm controls={controls} world={world} dock={selected} />}
        </div>
      ) : (
        <div className="inspector-empty">
          <span className={tool === 'demolish' ? 'empty-symbol text-error' : 'empty-symbol'}><Icon name={tool === 'demolish' ? 'trash' : 'target'} /></span>
          <h3>{tool === 'demolish' ? 'Démolition' : 'Aucun équipement sélectionné'}</h3>
          <p>{tool === 'demolish'
            ? 'Cliquez sur un équipement pour voir son remboursement et confirmer sa démolition.'
            : 'Sélectionnez un équipement sur la grille pour voir son emprise, ses ports et son contenu.'}</p>
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
