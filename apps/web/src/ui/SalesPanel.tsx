import { PRODUCT_MODELS, WORKSHOP, saleOffer } from '@silicon-empire/game-data';
import { modelUnlocked, rewardsEarned, salesAccounts } from '@silicon-empire/simulation';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { SaleTerms } from '@silicon-empire/game-data';
import type { World } from '@silicon-empire/simulation';
import type { Messages } from '../i18n';
import type { WorkshopControls } from '../game/controls';

function offerName(terms: SaleTerms, t: Messages): string {
  return terms.design ? `${terms.design.spec.name} · ${t.design.revision} ${terms.revision}` : t.items[terms.item];
}

export function ShippingDetails({ world, controls }: { world: World; controls: WorkshopControls }) {
  const { t, money } = useI18n();
  const order = world.sales.active;
  return (
    <div className="headquarters-details">
      <h4 className="inspector-subtitle">{t.trade.active}</h4>
      {order ? (
        <>
          <p>{offerName(order.terms, t)}</p>
          <p>{t.trade.shipped} · {order.delivered} / {order.terms.units}</p>
          <p>{t.trade.payout} · {money(order.terms.units * order.terms.unitPriceCents)}</p>
        </>
      ) : <p>{t.trade.none}</p>}
      <button type="button" className="button" onClick={() => controls.store.setState({ salesOpen: true })}>{t.trade.title}</button>
    </div>
  );
}

export function SalesPanel({ world, controls }: { world: World; controls: WorkshopControls }) {
  const { t, money } = useI18n();
  const { revenueCents, materialCents } = salesAccounts(world.sales);
  const grants = rewardsEarned(world.progress);
  const purchases = world.ledger.purchaseSpentCents;
  const investment = WORKSHOP.initialCapitalCents + revenueCents + grants - purchases - world.capitalCents;
  const active = world.sales.active;
  const latest = world.sales.completed.at(-1);
  const dock = world.machines.some(machine => machine.type === 'shipping');
  const close = () => controls.store.setState({ salesOpen: false });

  return (
    <Dialog wide title={t.trade.title} onDismiss={close}
      actions={<button type="button" className="button" onClick={close}>{t.progression.close}</button>}
    >
      <section className="tier" aria-label={t.trade.offers}>
        <h3>{t.trade.offers}</h3>
        <p>{dock ? t.trade.route : t.errors['no-shipping-dock']}</p>
        {active ? (
          <div className="milestone">
            <h4>{t.trade.active} · {offerName(active.terms, t)}</h4>
            <p>{t.trade.shipped} · {active.delivered} / {active.terms.units}</p>
            <progress max={active.terms.units} value={active.delivered} aria-label={t.trade.shipped} />
            <p>{t.trade.payout} · {money(active.terms.units * active.terms.unitPriceCents)}</p>
            {active.delivered === 0 && <button className="button" type="button" onClick={controls.cancelSale}>{t.trade.cancel}</button>}
          </div>
        ) : (
          <ul className="milestone-list">
            {PRODUCT_MODELS.filter(model => modelUnlocked(world.progress, model)).map(model => {
              const terms = saleOffer(model, world.design);
              if (!terms) return null;
              const name = offerName(terms, t);
              return (
                <li className="milestone" key={model} aria-label={name}>
                  <h4>{terms.units} × {name}</h4>
                  <dl className="milestone-rewards">
                    <div><dt>{t.trade.payout}</dt><dd>{money(terms.units * terms.unitPriceCents)}</dd></div>
                    <div><dt>{t.trade.margin}</dt><dd>{money(terms.units * (terms.unitPriceCents - terms.unitMaterialCents))}</dd></div>
                  </dl>
                  <button className="button button-primary" type="button" disabled={!dock} onClick={() => controls.startSale(model)}>{t.trade.accept}</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <section className="tier" aria-label={t.trade.finance}>
        <h3>{t.trade.finance}</h3>
        <dl className="machine-stats">
          <div><dt>{t.trade.revenue}</dt><dd aria-label={t.trade.revenue}>{money(revenueCents)}</dd></div>
          <div><dt>{t.trade.grants}</dt><dd>{money(grants)}</dd></div>
          <div><dt>{t.trade.purchases}</dt><dd>{money(purchases)}</dd></div>
          <div><dt>{t.trade.investment}</dt><dd>{money(investment)}</dd></div>
          <div><dt>{t.trade.material}</dt><dd>{money(materialCents)}</dd></div>
          <div><dt>{t.trade.margin}</dt><dd>{money(revenueCents - materialCents)}</dd></div>
        </dl>
        <p>{latest ? `${t.trade.latest} · ${latest.units} × ${offerName(latest, t)} · ${money(latest.units * latest.unitPriceCents)}` : t.trade.noSale}</p>
      </section>
    </Dialog>
  );
}
