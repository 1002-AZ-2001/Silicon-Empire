import {
  CAREER, COMPONENT_RECIPES, ITEM_TYPES, LOANS, LOAN_IDS, MACHINES, MARKET_PRICES, SPECIALTIES, TECHNOLOGIES, TECH_IDS, instalment,
  isComponentMachine,
} from '@silicon-empire/game-data';
import { loanAvailable, monthlyDue, payoff, techAvailable, wholesalePrice } from '@silicon-empire/simulation';
import { ITEM_ART } from '../art/items';
import { MACHINE_ART } from '../art/machines';
import { useI18n } from '../i18n';
import { Dialog, gameTime } from './shared';
import type { ItemType, Specialty, TechId } from '@silicon-empire/game-data';
import type { CareerState, World } from '@silicon-empire/simulation';
import type { WorkshopControls } from '../game/controls';

/** Production machine opened by a specialty licence. */
function specialtyMachine(specialty: Specialty) {
  return TECHNOLOGIES[specialty].unlocks.machines.find(isComponentMachine);
}

function ItemChip({ item, count }: { item: ItemType; count?: number }) {
  const { t } = useI18n();
  return (
    <span className="item-chip">
      <img src={ITEM_ART[item]} alt="" />
      {count !== undefined && `${count} × `}{t.items[item]}
    </span>
  );
}

export function StarterPanel({ controls, onMenu }: { controls: WorkshopControls; onMenu: () => void }) {
  const { t, money } = useI18n();
  return (
    <Dialog
      wide
      title={t.career.starter.title}
      onDismiss={() => undefined}
      actions={<button type="button" className="button" onClick={onMenu}>{t.workshop.menu}</button>}
    >
      <p>{t.career.starter.intro}</p>
      <ul className="starter-list">
        {SPECIALTIES.map(specialty => {
          const machine = specialtyMachine(specialty);
          if (!machine) return null;
          const recipe = COMPONENT_RECIPES[machine];
          return (
            <li key={specialty} className="starter-card" aria-label={t.career.tech.names[specialty]}>
              <img className="starter-art" src={MACHINE_ART[machine]} alt="" />
              <h3>{t.career.tech.names[specialty]}</h3>
              <p>{t.career.starter.descriptions[specialty]}</p>
              <dl className="machine-stats">
                <div><dt>{t.machines[machine].name}</dt><dd>{money(MACHINES[machine].costCents)}</dd></div>
                <div><dt>{t.career.starter.makes}</dt><dd><ItemChip item={recipe.output} /></dd></div>
                <div>
                  <dt>{t.career.starter.from}</dt>
                  <dd>
                    {(Object.entries(recipe.inputs) as [ItemType, number][]).map(([item, count]) => (
                      <ItemChip key={item} item={item} count={count} />
                    ))}
                  </dd>
                </div>
              </dl>
              <p className="placement-status">{t.career.starter.sells(money(MARKET_PRICES[recipe.output] ?? 0))}</p>
              <button type="button" className="button button-primary" onClick={() => controls.chooseSpecialty(specialty)}>
                {t.career.starter.choose}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

export function BankPanel({ world, career, controls, onClose }: {
  world: World; career: CareerState; controls: WorkshopControls; onClose: () => void;
}) {
  const { t, money } = useI18n();
  return (
    <Dialog wide title={t.career.bank.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.tutorial.close}</button>}
    >
      <p>{t.career.bank.intro}</p>
      <p className="tier-hint">{t.career.bank.warning}</p>
      <h3>{t.career.bank.offers}</h3>
      <ul className="milestone-list">
        {LOAN_IDS.map(id => {
          const offer = LOANS[id];
          return (
            <li key={id} className="milestone" aria-label={t.career.bank.offerNames[id]}>
              <header><h4>{t.career.bank.offerNames[id]}</h4><strong>{money(offer.principalCents)}</strong></header>
              <dl className="milestone-rewards">
                <div><dt>{t.career.bank.interest(offer.interestPercent)}</dt><dd>{t.career.bank.duration(offer.months)}</dd></div>
                <div><dt>{t.career.bank.instalment(money(instalment(offer)))}</dt><dd /></div>
              </dl>
              <button type="button" className="button button-primary" disabled={!loanAvailable(career, id)} onClick={() => controls.takeLoan(id)}>
                {t.career.bank.take(money(offer.principalCents))}
              </button>
            </li>
          );
        })}
      </ul>
      <h3>{t.career.bank.active}</h3>
      {career.loans.length === 0 ? <p className="placement-status">{t.career.bank.none}</p> : (
        <ul className="stock-list loan-list" aria-label={t.career.bank.active}>
          {career.loans.map(loan => (
            <li key={loan.offer} aria-label={t.career.bank.offerNames[loan.offer]}>
              <span>{t.career.bank.offerNames[loan.offer]}</span>
              <span>{t.career.bank.remaining(loan.remaining)} · {t.career.bank.instalment(money(instalment(LOANS[loan.offer])))}</span>
              <button type="button" className="button" disabled={world.capitalCents < payoff(loan)} onClick={() => controls.repayLoan(loan.offer)}>
                {t.career.bank.repay(money(payoff(loan)))}
              </button>
            </li>
          ))}
        </ul>
      )}
      {monthlyDue(career) > 0 && (
        <p className="placement-status">{t.career.bank.nextInstalment(money(monthlyDue(career)), gameTime(career.nextInstalment - world.tick))}</p>
      )}
      {career.missed > 0 && <p className="text-error">{t.career.bank.missed(career.missed, CAREER.maxMissed)}</p>}
    </Dialog>
  );
}

function techState(career: CareerState, tech: TechId): 'owned' | 'available' | 'locked' {
  if (career.technologies.includes(tech)) return 'owned';
  return techAvailable(career, tech) ? 'available' : 'locked';
}

export function TechPanel({ world, career, controls, onClose }: {
  world: World; career: CareerState; controls: WorkshopControls; onClose: () => void;
}) {
  const { t, money } = useI18n();
  return (
    <Dialog wide title={t.career.tech.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.tutorial.close}</button>}
    >
      <p>{t.career.tech.intro}</p>
      <ul className="milestone-list">
        {TECH_IDS.map(tech => {
          const state = techState(career, tech);
          const { costCents, requires, branches, unlocks } = TECHNOLOGIES[tech];
          const prerequisites = [
            ...requires.map(required => t.career.tech.names[required]),
            ...branches > 0 ? [t.career.tech.branches(branches)] : [],
          ];
          return (
            <li key={tech} className={`milestone milestone-${state === 'owned' ? 'completed' : state}`} aria-label={t.career.tech.names[tech]}>
              <header>
                <h4>{t.career.tech.names[tech]}</h4>
                <span className="milestone-state">{t.career.tech[state]}</span>
              </header>
              <dl className="milestone-rewards">
                <div>
                  <dt>{t.career.tech.unlocks}</dt>
                  <dd>{[...unlocks.machines.map(machine => t.machines[machine].name), ...unlocks.items.map(item => t.items[item])].join(', ')}</dd>
                </div>
                {prerequisites.length > 0 && <div><dt>{t.career.tech.requires}</dt><dd>{prerequisites.join(', ')}</dd></div>}
              </dl>
              {state === 'available' && (
                <button type="button" className="button button-primary" disabled={world.capitalCents < costCents} onClick={() => controls.buyTech(tech)}>
                  {t.career.tech.buy(money(costCents))}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

export function MarketPrices({ career, bonus }: { career: CareerState; bonus: number }) {
  const { t, money } = useI18n();
  return (
    <section className="tier" aria-label={t.career.market.title}>
      <h3>{t.career.market.title}</h3>
      <p>{t.career.market.intro}</p>
      <ul className="stock-list">
        {ITEM_TYPES.filter(item => MARKET_PRICES[item] !== undefined).map(item => (
          <li key={item}>
            <img src={ITEM_ART[item]} alt="" />
            <span>{t.items[item]} · {career.marketShipped[item] ?? 0}</span>
            <strong>{money(wholesalePrice(item, bonus))}</strong>
          </li>
        ))}
      </ul>
      <p className="placement-status">{t.career.market.revenue} · {money(career.marketRevenueCents)}</p>
    </section>
  );
}

export function BankruptPanel({ name, career, onMenu }: { name: string; career: CareerState; onMenu: () => void }) {
  const { t, money } = useI18n();
  return (
    <Dialog title={t.career.bankrupt.title} onDismiss={() => undefined}
      actions={<button type="button" className="button button-primary" onClick={onMenu}>{t.career.bankrupt.menu}</button>}
    >
      <p>{t.career.bankrupt.body(name)}</p>
      <p className="placement-status">{t.career.bankrupt.summary(money(career.marketRevenueCents), money(career.borrowedCents))}</p>
    </Dialog>
  );
}
