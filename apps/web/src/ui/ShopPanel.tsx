import {
  ERA_ITEMS, ITEMS, ITEM_CATEGORIES, ITEM_TYPES, MILESTONE_IDS, MILESTONES, PURCHASE, SUPPLIERS, SUPPLIER_IDS, eraOfYear,
} from '@silicon-empire/game-data';
import {
  checkPurchase, dockSpace, isPcPart, orderCost, orderableItems, partYear, partsBetween, purchaseCost, purchaseLineCost, volumeDiscount,
} from '@silicon-empire/simulation';
import { useState } from 'react';
import { useStore } from 'zustand';
import { ITEM_ART } from '../art/items';
import { cartLines } from '../game/controls';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { ItemCategory, ItemType, MilestoneId, SupplierId } from '@silicon-empire/game-data';
import type { World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

const SHOP_SORTS = ['category', 'name', 'priceAsc', 'priceDesc'] as const;
type ShopSort = (typeof SHOP_SORTS)[number];

/** Lower case without accents, so that a search for « ceramique » finds « céramique ». */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Components that can be bought at all, whether or not they are unlocked yet. Historical parts only exist in careers. */
const FULL_CATALOGUE = ITEM_TYPES.filter(item => ITEMS[item].unitCostCents !== null);
const MODERN_CATALOGUE = FULL_CATALOGUE.filter(item => !(ERA_ITEMS as readonly ItemType[]).includes(item));
const CATEGORIES = ITEM_CATEGORIES.filter(category => FULL_CATALOGUE.some(item => ITEMS[item].category === category));

function unlockingMilestone(item: ItemType): MilestoneId | undefined {
  return MILESTONE_IDS.find(id => MILESTONES[id].unlocks.items.includes(item));
}

/** Price of `lots` lots before any volume discount. */
function listPrice(item: ItemType, supplier: SupplierId, lots: number): number {
  return Math.floor((ITEMS[item].unitCostCents ?? 0) * PURCHASE.lotSize * lots * SUPPLIERS[supplier].pricePercent / 100);
}

export function ShopPanel({ world, controls, onClose }: { world: World; controls: WorkshopControls; onClose: () => void }) {
  const { t, money, locale } = useI18n();
  const cart = useStore(controls.store, state => state.cart);
  const docks = world.machines.filter(machine => machine.type === 'receiving');
  const [chosenDock, setDock] = useState<number | null>(null);
  const dock = docks.find(candidate => candidate.id === chosenDock) ?? docks[0];
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const orderable = orderableItems(world.progress);
  const lines = cartLines(cart);
  const lots = lines.reduce((total, line) => total + line.lots, 0);
  const total = purchaseCost(lines);
  const savings = lines.reduce((sum, line) => sum + listPrice(line.item, line.supplier, line.lots), 0) - total;
  const free = dock ? dockSpace(world, dock.id) : 0;
  const error = dock ? checkPurchase(world, dock.id, lines) : null;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<ShopSort>('category');
  const search = fold(query.trim());
  const career = world.progress.career;
  // A career shows the PC parts of the eras from its start year on.
  const catalogue = career
    ? FULL_CATALOGUE.filter(item => !isPcPart(item) || partsBetween(eraOfYear(career.startYear), 'modern').includes(item))
    : MODERN_CATALOGUE;
  const year = (item: ItemType) => career && isPcPart(item) ? partYear(item) : undefined;
  const shown = catalogue
    .filter(item => category === 'all' || ITEMS[item].category === category)
    .filter(item => search === '' || fold(`${t.items[item]} ${ITEMS[item].manufacturer}`).includes(search))
    .sort((a, b) => sort === 'name' ? t.items[a].localeCompare(t.items[b], locale)
      : sort === 'priceAsc' ? (ITEMS[a].unitCostCents ?? 0) - (ITEMS[b].unitCostCents ?? 0)
        : sort === 'priceDesc' ? (ITEMS[b].unitCostCents ?? 0) - (ITEMS[a].unitCostCents ?? 0)
          : ITEM_CATEGORIES.indexOf(ITEMS[a].category) - ITEM_CATEGORIES.indexOf(ITEMS[b].category) ||
            (year(a) ?? 0) - (year(b) ?? 0));

  return (
    <Dialog
      wide
      title={t.shop.title}
      onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.shop.close}</button>}
    >
      <p>{t.shop.intro}</p>
      <p className="tier-hint">{[...PURCHASE.volumeDiscounts].reverse().map(tier => t.shop.tier(tier.lots, tier.percent)).join(' · ')}</p>
      <div className="shop-settings order-form">
        {dock ? (
          <label>
            <span>{t.shop.dock}</span>
            <select value={dock.id} onChange={event => setDock(Number(event.target.value))}>
              {docks.map(candidate => (
                <option key={candidate.id} value={candidate.id}>{t.shop.dockOption(candidate.id, dockSpace(world, candidate.id))}</option>
              ))}
            </select>
          </label>
        ) : <p className="text-error">{t.shop.noDock}</p>}
        <label>
          <span>{t.supply.supplier}</span>
          <select
            value={cart.supplier}
            onChange={event => controls.store.setState({ cart: { ...cart, supplier: event.target.value as SupplierId } })}
          >
            {SUPPLIER_IDS.map(option => <option key={option} value={option}>{t.supply[option]}</option>)}
          </select>
        </label>
        <label>
          <span>{t.shop.category}</span>
          <select value={category} onChange={event => setCategory(event.target.value as ItemCategory | 'all')}>
            <option value="all">{t.shop.all}</option>
            {CATEGORIES.map(option => <option key={option} value={option}>{t.shop.categories[option]}</option>)}
          </select>
        </label>
        <label>
          <span>{t.shop.sort}</span>
          <select value={sort} onChange={event => setSort(event.target.value as ShopSort)}>
            {SHOP_SORTS.map(option => <option key={option} value={option}>{t.shop.sorts[option]}</option>)}
          </select>
        </label>
        <label className="shop-search">
          <span>{t.shop.search}</span>
          <input type="search" value={query} placeholder={t.shop.searchPlaceholder} onChange={event => setQuery(event.target.value)} />
        </label>
      </div>

      <div className="shop-layout">
        <ul className="shop-catalogue" aria-label={t.shop.title}>
          {shown.length === 0 && <li className="placement-status">{t.shop.noResult}</li>}
          {shown.map(item => {
            const locked = !orderable.has(item);
            const milestone = unlockingMilestone(item);
            const inCart = cart.lots[item] ?? 0;
            return (
              <li key={item} className={locked ? 'shop-item shop-item-locked' : 'shop-item'} aria-label={t.items[item]}>
                <img src={ITEM_ART[item]} alt="" />
                <div>
                  <strong>{t.items[item]}</strong>
                  <small>{ITEMS[item].manufacturer}</small>
                  <span>{t.shop.unitPrice(money(Math.floor(orderCost(item, cart.supplier) / PURCHASE.lotSize)))}</span>
                  <span>{t.shop.lotPrice(PURCHASE.lotSize, money(orderCost(item, cart.supplier)))}</span>
                </div>
                {locked
                  ? (
                    <p className="order-hint">
                      {career && year(item) !== undefined
                        ? career.technologies.includes('computers') ? t.shop.onSaleIn(year(item) ?? 0) : t.shop.needsComputers
                        : milestone ? t.shop.unlockedBy(t.progression.milestones[milestone]) : t.errors.locked}
                    </p>
                  )
                  : (
                    <button
                      type="button"
                      className="button"
                      disabled={inCart >= PURCHASE.maxLots}
                      onClick={() => controls.setCartLots(item, inCart + 1)}
                    >
                      {t.shop.add}
                    </button>
                  )}
              </li>
            );
          })}
        </ul>

        <section className="shop-cart" aria-label={t.shop.cart}>
          <h3>{t.shop.cart}</h3>
          {lines.length === 0 ? <p className="placement-status">{t.shop.emptyCart}</p> : (
            <ul className="stock-list">
              {lines.map(line => {
                const discount = volumeDiscount(line.lots);
                return (
                  <li key={line.item} aria-label={t.items[line.item]}>
                    <img src={ITEM_ART[line.item]} alt="" />
                    <span>{t.items[line.item]}</span>
                    <span className="cart-stepper">
                      <button type="button" className="button" aria-label={t.shop.less} onClick={() => controls.setCartLots(line.item, line.lots - 1)}>−</button>
                      <output>{t.shop.lots(line.lots)}</output>
                      <button
                        type="button"
                        className="button"
                        aria-label={t.shop.more}
                        disabled={line.lots >= PURCHASE.maxLots}
                        onClick={() => controls.setCartLots(line.item, line.lots + 1)}
                      >+</button>
                    </span>
                    <strong>
                      {money(purchaseLineCost(line))}
                      {discount > 0 && <small className="cart-discount"> {t.shop.discount(discount)}</small>}
                    </strong>
                    <button type="button" className="button" aria-label={t.shop.remove} onClick={() => controls.setCartLots(line.item, 0)}>×</button>
                  </li>
                );
              })}
            </ul>
          )}
          <dl className="machine-stats">
            {dock && <div><dt>{t.shop.dock}</dt><dd>{t.shop.space(lots * PURCHASE.lotSize, free)}</dd></div>}
            <div><dt>{t.shop.total}</dt><dd>{money(total)}</dd></div>
          </dl>
          {savings > 0 && <p className="placement-status">{t.shop.savings(money(savings))}</p>}
          {error && lines.length > 0 && <p className="order-hint text-error">{t.errors[error]}</p>}
          <button
            type="button"
            className="button button-primary"
            disabled={!dock || error !== null}
            onClick={() => { if (dock) controls.checkout(dock.id); }}
          >
            {t.shop.checkout(money(total))}
          </button>
        </section>
      </div>
    </Dialog>
  );
}
