import { CONVEYOR, ITEMS, ITEM_TYPES, MACHINES, PURCHASE } from '@silicon-empire/game-data';
import {
  ROUTER_SIDES, beltStatus, beltTarget, checkBuild, checkLine, checkOrder, footprintOf, inventoryTotal, lineCost,
  orderCost, portConnections, portsOf, routerLinks,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { useStore } from 'zustand';
import { ITEM_ART } from '../art/items';
import { MACHINE_ART } from '../art/machines';
import { ERROR_LABELS, isBuildTool } from '../game/controls';
import { DIRECTIONS, Icon, money } from './shared';
import type { ItemType } from '@silicon-empire/game-data';
import type { BeltStatus, Inventory, Machine, Placement, RouterSide, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

const BELT_STATUS: Record<BeltStatus, string> = {
  empty: 'Vide',
  moving: 'En mouvement',
  blocked: 'Saturé',
};

const UNITS_PER_BELT = Math.ceil(CONVEYOR.lengthUnits / CONVEYOR.spacingUnits);

const SIDE_LABELS: Record<RouterSide, string> = { left: 'Gauche', front: 'Avant', right: 'Droite' };
const MERGER_INPUTS = ['Gauche', 'Arrière', 'Droite'] as const;

function FilterForm({ controls, splitter }: { controls: WorkshopControls; splitter: Machine }) {
  const filter = splitter.filter;
  return (
    <form className="order-form" onSubmit={event => event.preventDefault()}>
      <h4>Filtre</h4>
      <label>
        <span>Composant filtré</span>
        <select
          value={filter?.item ?? ''}
          onChange={event => {
            const item = event.target.value as ItemType | '';
            controls.configure(splitter.id, item ? { item, output: filter?.output ?? 'front' } : null);
          }}
        >
          <option value="">Aucun : alternance sur toutes les sorties</option>
          {ITEM_TYPES.map(option => <option key={option} value={option}>{ITEMS[option].name}</option>)}
        </select>
      </label>
      <label>
        <span>Sortie du filtre</span>
        <select
          value={filter?.output ?? 'front'}
          disabled={!filter}
          onChange={event => {
            if (filter) controls.configure(splitter.id, { item: filter.item, output: event.target.value as RouterSide });
          }}
        >
          {ROUTER_SIDES.map(side => <option key={side} value={side}>{SIDE_LABELS[side]}</option>)}
        </select>
      </label>
    </form>
  );
}

function RouterDetails({ world, machine }: { world: World; machine: Machine }) {
  const links = routerLinks(world, machine.id);
  const held = world.routers[machine.id]?.held;
  const outputs = machine.type === 'splitter'
    ? ROUTER_SIDES.map((side, index) => [`Sortie ${SIDE_LABELS[side].toLowerCase()}`, links?.outputs[index]] as const)
    : [['Sortie avant', links?.outputs[0]] as const];
  const inputs = machine.type === 'splitter'
    ? [['Entrée arrière', links?.inputs[0]] as const]
    : MERGER_INPUTS.map((label, index) => [`Entrée ${label.toLowerCase()}`, links?.inputs[index]] as const);
  return (
    <dl className="machine-stats logistics-stats">
      <div><dt>En transit</dt><dd>{held ? ITEMS[held.item].name : 'Vide'}</dd></div>
      {[...inputs, ...outputs].map(([label, link]) => (
        <div key={label}><dt>{label}</dt><dd>{link === null || link === undefined ? 'libre' : 'raccordée'}</dd></div>
      ))}
    </dl>
  );
}

function LinePreview({ world, line }: { world: World; line: NonNullable<ReturnType<WorkshopControls['store']['getState']>['line']> }) {
  const error = checkLine(world, line);
  return (
    <div className="inspector-detail">
      <h3>Tracé de convoyeurs</h3>
      <dl className="machine-stats">
        <div><dt>Longueur</dt><dd>{line.length} {line.length > 1 ? 'tuiles' : 'tuile'}</dd></div>
        <div><dt>Coût</dt><dd aria-label="Coût du tracé">{money(lineCost(line.length))}</dd></div>
      </dl>
      <p className={error ? 'placement-status text-error' : 'placement-status'}>
        {error ? ERROR_LABELS[error] : 'Relâchez pour construire la ligne.'}
      </p>
    </div>
  );
}

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
  if (machine.type === 'splitter' || machine.type === 'merger') return <RouterDetails world={world} machine={machine} />;
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
  const { tool, hover, rotation, selectedId, feedback, line } = useStore(controls.store);
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

      {line && line.length > 1 ? <LinePreview world={world} line={line} /> : placement && definition && footprint ? (
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
          {selected?.type === 'splitter' && <FilterForm controls={controls} splitter={selected} />}
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
