import {
  HOME_REGION, PRODUCT_LINES, REGIONS, REGION_IDS, SUBSIDIARY_DESTINATIONS, SUBSIDIARY_PRODUCTS, TRANSPORT_MODES,
} from '@silicon-empire/game-data';
import {
  checkFactory, checkSubsidiary, erasBehind, homePrice, localPrice, monthlyCost, monthlyMargin, regionOpen,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { ITEM_ART } from '../art/items';
import { useI18n } from '../i18n';
import { Dialog, gameTime } from './shared';
import type { RegionId, SubsidiaryDestination, SubsidiaryProduct, TransportMode } from '@silicon-empire/game-data';
import type { AbroadContext, CareerState, Subsidiary, SubsidiarySettings, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

/** Simplified continents, in percent of the map (x from the west, y from the north). */
const CONTINENTS = [
  [[6, 12], [20, 8], [34, 12], [32, 22], [26, 34], [22, 42], [16, 40], [10, 28]],
  [[16, 40], [22, 42], [26, 50], [21, 52]],
  [[26, 52], [36, 54], [38, 64], [32, 80], [28, 88], [26, 70], [24, 58]],
  [[44, 18], [54, 14], [60, 20], [58, 30], [50, 34], [44, 30]],
  [[46, 40], [58, 38], [64, 50], [58, 68], [52, 72], [46, 56]],
  [[60, 14], [82, 10], [94, 20], [92, 34], [84, 44], [76, 50], [68, 48], [62, 36], [60, 24]],
  [[66, 44], [72, 44], [69, 54]],
  [[82, 64], [94, 64], [94, 76], [84, 76]],
];
const HEIGHT = 60;
/** Regions whose name goes under the marker, so that close neighbours stay readable. */
const LABEL_BELOW: readonly RegionId[] = ['eastern-europe', 'india'];
const point = ([x, y]: number[]) => `${x},${(y ?? 0) * HEIGHT / 100}`;

type RegionState = 'home' | 'owned' | 'open' | 'closed';

function regionState(career: CareerState, region: RegionId, tick: number): RegionState {
  if (region === HOME_REGION) return 'home';
  if (career.abroad.subsidiaries.some(subsidiary => subsidiary.region === region)) return 'owned';
  return regionOpen(region, career.startYear, tick) ? 'open' : 'closed';
}

function WorldMap({ career, tick, selected, onSelect }: {
  career: CareerState; tick: number; selected: RegionId; onSelect: (region: RegionId) => void;
}) {
  const { t } = useI18n();
  const home = REGIONS[HOME_REGION].map;
  return (
    <svg className="world-map" viewBox={`0 0 100 ${HEIGHT}`} role="img" aria-label={t.world.map}>
      <rect width="100" height={HEIGHT} className="world-sea" />
      {CONTINENTS.map((shape, index) => <polygon key={index} className="world-land" points={shape.map(point).join(' ')} />)}
      {career.abroad.subsidiaries.map(subsidiary => {
        const { x, y } = REGIONS[subsidiary.region].map;
        return (
          <line key={subsidiary.region} className={`world-route world-route-${subsidiary.mode}`}
            x1={x} y1={y * HEIGHT / 100} x2={home.x} y2={home.y * HEIGHT / 100} />
        );
      })}
      {REGION_IDS.map(region => {
        const { x, y } = REGIONS[region].map;
        const state = regionState(career, region, tick);
        return (
          <g key={region} className={`world-marker world-${state}${region === selected ? ' world-selected' : ''}`} onClick={() => onSelect(region)}>
            <circle cx={x} cy={y * HEIGHT / 100} r={region === selected ? 2.4 : 1.8} />
            <text x={x} y={y * HEIGHT / 100 + (LABEL_BELOW.includes(region) ? 4.6 : -3)}>{t.world.regions[region]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SubsidiaryForm({ world, subsidiary, context, controls }: {
  world: World; subsidiary: Subsidiary; context: AbroadContext; controls: WorkshopControls;
}) {
  const { t, money } = useI18n();
  const docks = world.machines.filter(machine => machine.type === 'receiving');
  const [settings, setSettings] = useState<SubsidiarySettings>({
    product: subsidiary.product, destination: subsidiary.destination, mode: subsidiary.mode, dockId: subsidiary.dockId,
  });
  const change = (patch: Partial<SubsidiarySettings>) => setSettings(current => {
    const next = { ...current, ...patch };
    return { ...next, dockId: next.destination === 'dock' ? next.dockId ?? docks[0]?.id ?? null : null };
  });
  const error = checkSubsidiary(world, subsidiary.region, settings);
  const draft = { region: subsidiary.region, ...settings };
  const { product } = settings;
  return (
    <form className="order-form world-form" onSubmit={event => { event.preventDefault(); controls.setSubsidiary(subsidiary.region, settings); }}>
      <label>
        <span>{t.world.product}</span>
        <select value={product ?? ''} onChange={event => change({ product: event.target.value === '' ? null : event.target.value as SubsidiaryProduct })}>
          <option value="">{t.world.noProduct}</option>
          {SUBSIDIARY_PRODUCTS.map(option => <option key={option} value={option}>{t.items[option]}</option>)}
        </select>
      </label>
      <label>
        <span>{t.world.destination}</span>
        <select value={settings.destination} onChange={event => change({ destination: event.target.value as SubsidiaryDestination })}>
          {SUBSIDIARY_DESTINATIONS.map(option => <option key={option} value={option}>{t.world.destinations[option]}</option>)}
        </select>
      </label>
      {settings.destination !== 'local' && (
        <label>
          <span>{t.world.mode}</span>
          <select value={settings.mode} onChange={event => change({ mode: event.target.value as TransportMode })}>
            {TRANSPORT_MODES.map(option => (
              <option key={option} value={option}>
                {option === 'air' ? t.world.modes.air(REGIONS[subsidiary.region].days.air)
                  : t.world.modes.surface(REGIONS[subsidiary.region].days.surface, subsidiary.region === 'eastern-europe')}
              </option>
            ))}
          </select>
        </label>
      )}
      {settings.destination === 'dock' && (
        docks.length === 0 ? <p className="order-hint text-error">{t.shop.noDock}</p> : (
          <label>
            <span>{t.shop.dock}</span>
            <select value={settings.dockId ?? ''} onChange={event => change({ dockId: Number(event.target.value) })}>
              {docks.map(dock => <option key={dock.id} value={dock.id}>{t.world.dockName(dock.id)}</option>)}
            </select>
          </label>
        )
      )}
      {product && (
        <dl className="machine-stats">
          <div><dt>{t.world.output}</dt><dd>{t.world.perMonth(PRODUCT_LINES[product].unitsPerMonth)}</dd></div>
          <div><dt>{t.world.price}</dt><dd>{money(settings.destination === 'local' ? localPrice(subsidiary.region, product, context) : homePrice(product, context))}</dd></div>
          <div><dt>{t.world.monthlyCost}</dt><dd>{money(monthlyCost(draft, context))}</dd></div>
          <div><dt>{t.world.margin}</dt><dd>{money(monthlyMargin(draft, context))}</dd></div>
        </dl>
      )}
      {error && <p className="order-hint text-error">{t.errors[error]}</p>}
      <button type="submit" className="button button-primary" disabled={error !== null}>{t.world.apply}</button>
    </form>
  );
}

export function WorldPanel({ world, career, controls, onClose }: {
  world: World; career: CareerState; controls: WorkshopControls; onClose: () => void;
}) {
  const { t, money } = useI18n();
  const [selected, setSelected] = useState<RegionId>(career.abroad.subsidiaries[0]?.region ?? 'china');
  const region = REGIONS[selected];
  const state = regionState(career, selected, world.tick);
  const subsidiary = career.abroad.subsidiaries.find(candidate => candidate.region === selected);
  const context: AbroadContext = { era: career.era, behind: erasBehind(career) };
  const licensed = career.technologies.includes('global');
  const error = state === 'open' ? checkFactory(world, selected) : null;
  return (
    <Dialog wide title={t.world.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.tutorial.close}</button>}
    >
      <p>{t.world.intro}</p>
      {!licensed && <p className="order-hint text-error">{t.world.needsLicence}</p>}
      <div className="world-layout">
        <div>
          <WorldMap career={career} tick={world.tick} selected={selected} onSelect={setSelected} />
          <div className="world-regions" role="group" aria-label={t.world.regionsLabel}>
            {REGION_IDS.map(id => (
              <button key={id} type="button" className="button" aria-pressed={id === selected} onClick={() => setSelected(id)}>
                {t.world.regions[id]}
              </button>
            ))}
          </div>
        </div>
        <section className="world-detail" aria-label={t.world.regions[selected]}>
          <header>
            <h3>{t.world.regions[selected]}</h3>
            <span className="milestone-state">{state === 'closed' ? t.world.states.closed(region.openYear) : t.world.states[state]}</span>
          </header>
          {selected === HOME_REGION ? <p>{t.world.home}</p> : (
            <>
              <dl className="machine-stats">
                <div><dt>{t.world.wages}</dt><dd>{region.wagePercent}&#8201;%</dd></div>
                <div><dt>{t.world.materials}</dt><dd>{region.materialPercent}&#8201;%</dd></div>
                <div><dt>{t.world.market}</dt><dd>{region.marketPercent}&#8201;%</dd></div>
                <div><dt>{t.world.transit}</dt><dd>{t.world.days(region.days.surface, region.days.air, selected === 'eastern-europe')}</dd></div>
                <div><dt>{t.world.freight}</dt><dd>{t.world.perKg(money(region.freightCentsPerKg.surface), money(region.freightCentsPerKg.air))}</dd></div>
                <div><dt>{t.world.factory}</dt><dd>{money(region.factoryCostCents)}</dd></div>
              </dl>
              {state === 'open' && (
                <>
                  <button type="button" className="button button-primary" disabled={error !== null} onClick={() => controls.buyFactory(selected)}>
                    {t.world.buy(money(region.factoryCostCents))}
                  </button>
                  {error && licensed && <p className="order-hint text-error">{t.errors[error]}</p>}
                </>
              )}
              {subsidiary && (
                <>
                  <button type="button" className="button" onClick={() => { controls.selectSite(subsidiary.region); onClose(); }}>
                    {t.sites.build}
                  </button>
                  <p className={subsidiary.idle ? 'order-hint text-error' : 'placement-status'}>
                    {subsidiary.idle ? t.world.idle : t.world.nextRun(gameTime(subsidiary.nextRun - world.tick))}
                  </p>
                  <SubsidiaryForm key={`${subsidiary.region}-${subsidiary.product ?? ''}-${subsidiary.destination}-${subsidiary.mode}`}
                    world={world} subsidiary={subsidiary} context={context} controls={controls} />
                </>
              )}
            </>
          )}
        </section>
      </div>

      <section aria-label={t.world.shipments}>
        <h3>{t.world.shipments}</h3>
        {career.abroad.shipments.length === 0 ? <p className="placement-status">{t.world.noShipment}</p> : (
          <ul className="stock-list">
            {career.abroad.shipments.map(shipment => (
              <li key={shipment.id}>
                <img src={ITEM_ART[shipment.item]} alt="" />
                <span>{shipment.units} × {t.items[shipment.item]} · {t.world.regions[shipment.region]}</span>
                <strong>{t.world.eta(gameTime(Math.max(0, shipment.dueTick - world.tick)))}</strong>
              </li>
            ))}
          </ul>
        )}
        <p className="placement-status">{t.world.totals(money(career.abroad.spentCents), money(career.abroad.revenueCents))}</p>
      </section>
    </Dialog>
  );
}
