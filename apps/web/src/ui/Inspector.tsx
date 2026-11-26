import {
  CONVEYOR, ITEMS, ITEM_TYPES, MACHINES, MK2, PRODUCTION, PRODUCT_MODELS, PURCHASE, SUPPLIER_IDS, isConveyor, recipeOf,
} from '@silicon-empire/game-data';
import {
  ROUTER_SIDES, batchTicks, beltStatus, beltTarget, checkBuild, checkLine, checkOrder, checkProductModel, footprintOf,
  inventoryTotal, lineCost, modelUnlocked, operatorOf, operatorRejection, orderCost, orderableItems, portConnections, portsOf,
  productionStatus, rejectionEvery, routerLinks,
  upgradeUnlocked,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { useStore } from 'zustand';
import { ITEM_ART } from '../art/items';
import { MACHINE_ART } from '../art/machines';
import { isBuildTool } from '../game/controls';
import { useI18n } from '../i18n';
import { MilestoneParts } from './ProgressionPanel';
import { AnalysisProgress, ResearchParts } from './ResearchPanel';
import { ShippingDetails } from './SalesPanel';
import { Icon, gameTime } from './shared';
import type { ItemType, ProductModel, SupplierId } from '@silicon-empire/game-data';
import type { Inventory, Machine, Placement, RouterSide, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

const UNITS_PER_BELT = Math.ceil(CONVEYOR.lengthUnits / CONVEYOR.spacingUnits);

const MERGER_INPUTS = ['left', 'back', 'right'] as const;

function FilterForm({ controls, splitter }: { controls: WorkshopControls; splitter: Machine }) {
  const filter = splitter.filter;
  const { t } = useI18n();
  return (
    <form className="order-form" onSubmit={event => event.preventDefault()}>
      <h4>{t.inspector.filter}</h4>
      <label>
        <span>{t.inspector.filterItem}</span>
        <select
          value={filter?.item ?? ''}
          onChange={event => {
            const item = event.target.value as ItemType | '';
            controls.configure(splitter.id, item ? { item, output: filter?.output ?? 'front' } : null);
          }}
        >
          <option value="">{t.inspector.filterNone}</option>
          {ITEM_TYPES.map(option => <option key={option} value={option}>{t.items[option]}</option>)}
        </select>
      </label>
      <label>
        <span>{t.inspector.filterOutput}</span>
        <select
          value={filter?.output ?? 'front'}
          disabled={!filter}
          onChange={event => {
            if (filter) controls.configure(splitter.id, { item: filter.item, output: event.target.value as RouterSide });
          }}
        >
          {ROUTER_SIDES.map(side => <option key={side} value={side}>{t.inspector.sides[side]}</option>)}
        </select>
      </label>
    </form>
  );
}

function RouterDetails({ world, machine }: { world: World; machine: Machine }) {
  const links = routerLinks(world, machine.id);
  const held = world.routers[machine.id]?.held;
  const { t } = useI18n();
  const outputs = machine.type === 'splitter'
    ? ROUTER_SIDES.map((side, index) => [t.inspector.outputSide[side], links?.outputs[index]] as const)
    : [[t.inspector.outputSide.front, links?.outputs[0]] as const];
  const inputs = machine.type === 'splitter'
    ? [[t.inspector.inputSide.back, links?.inputs[0]] as const]
    : MERGER_INPUTS.map((side, index) => [t.inspector.inputSide[side], links?.inputs[index]] as const);
  return (
    <dl className="machine-stats logistics-stats">
      <div><dt>{t.inspector.inTransit}</dt><dd>{held ? t.items[held.item] : t.inspector.empty}</dd></div>
      {[...inputs, ...outputs].map(([label, link]) => (
        <div key={label}><dt>{label}</dt><dd>{link === null || link === undefined ? t.inspector.free : t.inspector.connected}</dd></div>
      ))}
    </dl>
  );
}

function LabDetails({ world, controls }: { world: World; controls: WorkshopControls }) {
  const { t } = useI18n();
  const { active, analysing } = world.research;
  return (
    <div className="headquarters-details">
      {analysing && (
        <>
          <h4 className="inspector-subtitle">{t.research.analysing}</h4>
          <p>{t.research.projects[analysing.id]}</p>
          <AnalysisProgress world={world} />
        </>
      )}
      <h4 className="inspector-subtitle">{t.research.active}</h4>
      {active
        ? <><p>{t.research.projects[active]}</p><ResearchParts world={world} id={active} /></>
        : <p className="placement-status">{t.research.none}</p>}
      <button type="button" className="button" onClick={() => controls.store.setState({ researchOpen: true })}>
        {t.workshop.research}
      </button>
    </div>
  );
}

function UpgradeButton({ world, machine, controls }: { world: World; machine: Machine; controls: WorkshopControls }) {
  const { t, money } = useI18n();
  if (machine.level === 2 || !upgradeUnlocked(world.progress, world.research, machine.type)) return null;
  const cost = MK2.costCents[machine.type];
  return (
    <div className="upgrade-box">
      <button type="button" className="button button-primary" disabled={world.capitalCents < cost} onClick={() => controls.upgrade(machine.id)}>
        {t.production.upgrade(money(cost))}
      </button>
      <p className="order-hint">{t.production.upgradeHint}</p>
    </div>
  );
}

function ProductionDetails({ world, machine, controls }: { world: World; machine: Machine; controls: WorkshopControls }) {
  const { t } = useI18n();
  const model = machine.model ?? 'office';
  const recipe = recipeOf(machine.type, model, world.design);
  if (!recipe) return null;
  const options = PRODUCT_MODELS.filter(option => modelUnlocked(world.progress, option) && (option !== 'custom' || world.design))
    .map(value => ({ value, error: checkProductModel(world, machine, value) }));
  const canChange = options.some(option => option.value !== model && option.error === null);
  const changeBlocked = canChange ? null : options.find(option => option.error !== null)?.error;
  const stock = world.stocks[machine.id] ?? {};
  const state = world.production[machine.id];
  // Mk2 machines start their batches with half the recipe time.
  const operator = operatorOf(world.staff, machine.id);
  const duration = batchTicks(recipe, machine, operator?.skill);
  const done = state?.batch ? Math.max(0, duration - state.batch.remaining) : 0;
  const every = operatorRejection(rejectionEvery(world.progress, world.research, recipe), operator?.skill);
  const output = state?.output[recipe.output] ?? 0;
  const rejection = recipe.rejection;
  const rejectPort = rejection && portConnections(world, machine).find(port => port.kind === 'reject');
  const status = productionStatus(world, machine.id);
  return (
    <>
      {options.length > 1 && (
        <div className="order-form">
          <label>
            <span>{t.production.model}</span>
            <select
              value={model}
              disabled={!canChange}
              aria-describedby={changeBlocked ? 'model-switch-help' : undefined}
              onChange={event => controls.setProductModel(machine.id, event.target.value as ProductModel)}
            >
              {options.map(({ value, error }) => (
                <option key={value} value={value} disabled={error !== null}>
                  {value === 'custom' ? world.design?.spec.name : t.production.models[value]}
                </option>
              ))}
            </select>
          </label>
          {changeBlocked && <p className="order-hint" id="model-switch-help">{t.errors[changeBlocked]}</p>}
        </div>
      )}
      <dl className="machine-stats logistics-stats">
        <div><dt>{t.inspector.state}</dt><dd className={`production-${status}`}>{t.production.status[status]}</dd></div>
        <div>
          <dt>{t.production.progress}</dt>
          <dd><progress max={duration} value={done} aria-label={t.production.progress} /> {Math.floor(done * 100 / duration)}&#8201;%</dd>
        </div>
        <div><dt>{t.production.level}</dt><dd>{machine.level === 2 ? 'Mk2' : 'Mk1'}</dd></div>
        <div>
          <dt>{t.production.operator}</dt>
          <dd>
            <select
              aria-label={t.production.operator}
              value={operator?.id ?? ''}
              onChange={event => {
                const chosen = event.target.value;
                if (chosen === '') { if (operator) controls.assign(operator.id, null); }
                else controls.assign(Number(chosen), machine.id);
              }}
            >
              <option value="">{t.production.noOperator}</option>
              {world.staff.employees.map(employee => (
                <option key={employee.id} value={employee.id}>{t.production.operatorOption(employee.name, employee.skill)}</option>
              ))}
            </select>
          </dd>
        </div>
        <div><dt>{t.production.output}</dt><dd>{t.items[recipe.output]} · {output} / {PRODUCTION.outputCapacity}</dd></div>
        {rejectPort && (
          <div>
            <dt>{t.production.rejectPort}</dt>
            <dd className={rejectPort.connected ? undefined : 'text-error'}>
              {t.directions[rejectPort.side]} · {rejectPort.connected ? t.inspector.connected : t.inspector.notConnected}
            </dd>
          </div>
        )}
        {rejection && (
          <div><dt>{t.production.rejectBuffer}</dt><dd>{state?.output[rejection.item] ?? 0} / {PRODUCTION.outputCapacity}</dd></div>
        )}
      </dl>
      {every !== null && <p className="placement-status">{t.production.rejectRate(every)}</p>}
      <UpgradeButton world={world} machine={machine} controls={controls} />
      <h4 className="inspector-subtitle">{t.production.recipe}</h4>
      {machine.type === 'packager' && <p className="placement-status">{t.production.packagerInputs}</p>}
      <ul className="stock-list" aria-label={t.production.recipe}>
        {ITEM_TYPES.filter(item => (recipe.inputs[item] ?? 0) > 0).map(item => (
          <li key={item}>
            <img src={ITEM_ART[item]} alt="" />
            <span>{(recipe.inputs[item] ?? 0)} × {t.items[item]}</span>
            <strong>{stock[item] ?? 0} / {(recipe.inputs[item] ?? 0) * PRODUCTION.inputBatches}</strong>
          </li>
        ))}
      </ul>
    </>
  );
}

function HeadquartersDetails({ world, controls }: { world: World; controls: WorkshopControls }) {
  const { t } = useI18n();
  const { progress } = world;
  if (progress.sandbox) return <p className="placement-status">{t.progression.sandbox}</p>;
  return (
    <div className="headquarters-details">
      <h4 className="inspector-subtitle">{t.production.objective}</h4>
      {progress.active
        ? <><p>{t.progression.milestones[progress.active]}</p><MilestoneParts world={world} id={progress.active} /></>
        : <p className="placement-status">{t.progression.none}</p>}
      <button type="button" className="button" onClick={() => controls.store.setState({ progressionOpen: true })}>
        {t.production.open}
      </button>
    </div>
  );
}

function LinePreview({ world, line, type }: {
  world: World;
  line: NonNullable<ReturnType<WorkshopControls['store']['getState']>['line']>;
  type: 'conveyor' | 'conveyor-fast';
}) {
  const error = checkLine(world, line, type);
  const { t, money } = useI18n();
  return (
    <div className="inspector-detail">
      <h3>{t.inspector.line}</h3>
      <dl className="machine-stats">
        <div><dt>{t.inspector.length}</dt><dd>{t.inspector.lineTiles(line.length)}</dd></div>
        <div><dt>{t.inspector.cost}</dt><dd aria-label={t.inspector.lineCost}>{money(lineCost(line.length, type))}</dd></div>
      </dl>
      <p className={error ? 'placement-status text-error' : 'placement-status'}>
        {error ? t.errors[error] : t.inspector.lineRelease}
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
  const { t } = useI18n();
  if (lines.length === 0) return null;
  return (
    <ul className="stock-list" aria-label={label}>
      {lines.map(item => (
        <li key={item}>
          <img src={ITEM_ART[item]} alt="" />
          <span>{t.items[item]}</span>
          <strong>{stock[item]}</strong>
        </li>
      ))}
    </ul>
  );
}

function OrderForm({ controls, world, dock }: { controls: WorkshopControls; world: World; dock: Machine }) {
  const [item, setItem] = useState<ItemType>(ITEM_TYPES[0]);
  const [supplier, setSupplier] = useState<SupplierId>('express');
  const orderable = orderableItems(world.progress);
  const pending = world.deliveries.filter(delivery => delivery.dockId === dock.id);
  const error = checkOrder(world, dock.id, item, supplier);
  const { t, money } = useI18n();
  return (
    <form
      className="order-form"
      onSubmit={event => {
        event.preventDefault();
        controls.order(dock.id, item, supplier);
      }}
    >
      <h4>{t.inspector.order}</h4>
      <label>
        <span>{t.inspector.component}</span>
        <select value={item} onChange={event => setItem(event.target.value as ItemType)}>
          {ITEM_TYPES.filter(option => orderable.has(option)).map(option => (
            <option key={option} value={option}>{t.items[option]} · {ITEMS[option].manufacturer}</option>
          ))}
        </select>
      </label>
      <label>
        <span>{t.supply.supplier}</span>
        <select value={supplier} onChange={event => setSupplier(event.target.value as SupplierId)}>
          {SUPPLIER_IDS.map(option => <option key={option} value={option}>{t.supply[option]}</option>)}
        </select>
      </label>
      <button className="button button-primary" type="submit" disabled={error !== null}>
        {t.inspector.orderButton(PURCHASE.lotSize, money(orderCost(item, supplier)))}
      </button>
      {error && <p className="order-hint text-error">{t.errors[error]}</p>}
      {pending.length > 0 && (
        <ul className="stock-list" aria-label={t.supply.pending}>
          {pending.map((delivery, index) => (
            <li key={index}><img src={ITEM_ART[delivery.item]} alt="" /><span>{PURCHASE.lotSize} × {t.items[delivery.item]}</span>
              <strong>{gameTime(delivery.dueTick - world.tick)}</strong></li>
          ))}
        </ul>
      )}
    </form>
  );
}

function Logistics({ world, machine, controls }: { world: World; machine: Machine; controls: WorkshopControls }) {
  const definition = MACHINES[machine.type];
  const { t } = useI18n();
  if (isConveyor(machine.type)) {
    const belt = world.belts[machine.id] ?? [];
    const target = beltTarget(world, machine.id);
    const receiver = target && world.machines.find(candidate => candidate.id === target.id);
    const onBelt = belt.reduce<Record<string, number>>((count, unit) => ({ ...count, [unit.item]: (count[unit.item] ?? 0) + 1 }), {});
    return (
      <>
        <dl className="machine-stats logistics-stats">
          <div><dt>{t.inspector.load}</dt><dd>{belt.length} / {UNITS_PER_BELT}</dd></div>
          <div><dt>{t.inspector.state}</dt><dd>{t.inspector.belt[beltStatus(world, machine.id)]}</dd></div>
          <div><dt>{t.inspector.destination}</dt><dd>{receiver ? t.machines[receiver.type].name : t.inspector.notConnected}</dd></div>
        </dl>
        <StockList stock={onBelt} label={t.inspector.beltUnits} />
      </>
    );
  }
  if (machine.type === 'splitter' || machine.type === 'merger') return <RouterDetails world={world} machine={machine} />;
  if (recipeOf(machine.type, machine.model, world.design)) return <ProductionDetails world={world} machine={machine} controls={controls} />;
  if (definition.capacity === 0) return null;

  const stock = world.stocks[machine.id] ?? {};
  return (
    <>
      <dl className="machine-stats logistics-stats">
        <div><dt>{t.inspector.stock}</dt><dd aria-label={t.inspector.stock}>{inventoryTotal(stock)} / {definition.capacity}</dd></div>
        {portConnections(world, machine).map((port, index) => (
          <div key={index}>
            <dt>{port.kind === 'input' ? t.inspector.input : t.inspector.output}</dt>
            <dd>{t.directions[port.side]} · {port.connected ? t.inspector.connected : t.inspector.free}</dd>
          </div>
        ))}
      </dl>
      <StockList stock={stock} label={t.inspector.stockContents} />
    </>
  );
}

export function Inspector({ controls, world }: { controls: WorkshopControls; world: World }) {
  const { tool, hover, rotation, selectedId, feedback, line } = useStore(controls.store);
  const translator = useI18n();
  const { t, money } = translator;
  const selected = world.machines.find(machine => machine.id === selectedId);
  const pending = isBuildTool(tool) ? { type: tool, x: hover?.x ?? 0, y: hover?.y ?? 0, rotation } : null;
  const placement = pending ?? selected;
  const previewError = pending && hover ? checkBuild(world, pending) : null;
  const previewMessage = previewError
    ? t.errors[previewError]
    : hover ? t.inspector.placementOk : t.inspector.placementHint;
  const feedbackText = feedback?.message(translator);
  const definition = placement && MACHINES[placement.type];
  const footprint = placement && footprintOf(placement);

  return (
    <aside className="inspector" aria-labelledby="inspector-heading">
      <h2 id="inspector-heading"><Icon name="target" /> {t.inspector.title}</h2>

      {line && line.length > 1 ? <LinePreview world={world} line={line} type={tool === 'conveyor-fast' ? 'conveyor-fast' : 'conveyor'} /> : placement && definition && footprint ? (
        <div className="inspector-detail">
          <MachinePreview placement={placement} />
          <h3>{t.machines[placement.type].name}</h3>
          <dl className="machine-stats">
            <div><dt>{t.inspector.footprint}</dt><dd>{footprint.width} × {footprint.height}</dd></div>
            <div><dt>{isConveyor(placement.type) ? t.inspector.direction : t.inspector.orientation}</dt><dd>{t.directions[placement.rotation]}</dd></div>
            {selected && <div><dt>{t.inspector.anchor}</dt><dd>{selected.x + 1}, {selected.y + 1}</dd></div>}
            <div><dt>{selected ? t.inspector.paid : t.inspector.cost}</dt><dd>{money(selected?.paidCents ?? definition.costCents)}</dd></div>
            {pending && definition.capacity > 0 && <div><dt>{t.inspector.capacity}</dt><dd>{t.inspector.units(definition.capacity)}</dd></div>}
            {pending && portsOf(pending).map((port, index) => (
              <div key={index}>
                <dt>{port.kind === 'input' ? t.inspector.input : t.inspector.output}</dt>
                <dd>{t.directions[port.side]}</dd>
              </div>
            ))}
          </dl>
          <button className="button rotate-button" type="button" onClick={controls.rotate} aria-keyshortcuts="R">
            <Icon name="rotate" /> {t.inspector.rotate} <kbd>R</kbd>
          </button>
          {pending && feedbackText !== previewMessage && (
            <p className={previewError ? 'placement-status text-error' : 'placement-status'}>
              {previewMessage}
            </p>
          )}
          {selected && <Logistics world={world} machine={selected} controls={controls} />}
          {selected?.type === 'receiving' && <OrderForm controls={controls} world={world} dock={selected} />}
          {selected?.type === 'splitter' && <FilterForm controls={controls} splitter={selected} />}
          {selected?.type === 'headquarters' && <HeadquartersDetails world={world} controls={controls} />}
          {selected?.type === 'lab' && <LabDetails world={world} controls={controls} />}
          {selected?.type === 'shipping' && <ShippingDetails world={world} controls={controls} />}
        </div>
      ) : (
        <div className="inspector-empty">
          <span className={tool === 'demolish' ? 'empty-symbol text-error' : 'empty-symbol'}><Icon name={tool === 'demolish' ? 'trash' : 'target'} /></span>
          <h3>{tool === 'demolish' ? t.inspector.demolition : t.inspector.nothingSelected}</h3>
          <p>{tool === 'demolish' ? t.inspector.demolitionHint : t.inspector.selectionHint}</p>
        </div>
      )}

      {feedback && (
        <p className={`workshop-feedback ${feedback.kind === 'error' ? 'text-error' : 'text-success'}`} role="status">
          {feedbackText}
        </p>
      )}
    </aside>
  );
}
