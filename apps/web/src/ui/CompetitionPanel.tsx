import { MARKET_DEMAND, MARKET_IDS, RIVALS, dateAt } from '@silicon-empire/game-data';
import { companyShare, rivalSupply } from '@silicon-empire/simulation';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { MarketId } from '@silicon-empire/game-data';
import type { CareerState, MarketNews } from '@silicon-empire/simulation';
import type { Messages } from '../i18n';

/** Name of a market: the component, or the PC model of its contracts. */
export function marketName(t: Messages, market: MarketId): string {
  return market === 'office' || market === 'gaming' || market === 'professional' ? t.production.models[market] : t.items[market];
}

export function newsText(t: Messages, news: MarketNews): string {
  const rival = RIVALS[news.rival].name;
  return news.kind === 'entry' || news.market === null ? t.competition.entry(rival) : t.competition.priceWar(rival, marketName(t, news.market));
}

function indexClass(price: number): string {
  return price >= 105 ? 'market-high' : price < 90 ? 'market-low' : 'market-even';
}

export function CompetitionPanel({ career, onClose }: { career: CareerState; onClose: () => void }) {
  const { t, locale } = useI18n();
  const { competition } = career;
  const month = (tick: number) => {
    const { year, month: index } = dateAt(career.startYear, tick);
    return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, index, 1)));
  };
  return (
    <Dialog wide title={t.competition.title} onDismiss={onClose}
      actions={<button type="button" className="button" onClick={onClose}>{t.tutorial.close}</button>}
    >
      <p>{t.competition.intro}</p>
      <table className="market-table" aria-label={t.competition.markets}>
        <thead>
          <tr>
            <th scope="col">{t.competition.market}</th>
            <th scope="col">{t.competition.demand}</th>
            <th scope="col">{t.competition.rivalsSupply}</th>
            <th scope="col">{t.competition.share}</th>
            <th scope="col">{t.competition.index}</th>
          </tr>
        </thead>
        <tbody>
          {MARKET_IDS.map(market => (
            <tr key={market} aria-label={marketName(t, market)}>
              <th scope="row">{marketName(t, market)}</th>
              <td>{MARKET_DEMAND[market]}</td>
              <td>{rivalSupply(competition, market)}</td>
              <td>{companyShare(competition, market)}&#8201;%</td>
              <td className={indexClass(competition.prices[market])}>{competition.prices[market]}&#8201;%</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="placement-status">{t.competition.hint}</p>

      <h3>{t.competition.rivals}</h3>
      <ul className="milestone-list">
        {competition.rivals.map(rival => (
          <li key={rival.id} className="milestone" aria-label={RIVALS[rival.id].name}>
            <header><h4>{RIVALS[rival.id].name}</h4><span className="milestone-state">{t.competition.since(RIVALS[rival.id].entryYear)}</span></header>
            <dl className="milestone-rewards">
              {(Object.entries(rival.supply) as [MarketId, number][]).map(([market, units]) => (
                <div key={market}><dt>{marketName(t, market)}</dt><dd>{t.competition.perMonth(units)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <h3>{t.competition.news}</h3>
      {competition.news.length === 0 ? <p className="placement-status">{t.competition.noNews}</p> : (
        <ul className="stock-list" aria-label={t.competition.news}>
          {competition.news.map(news => (
            <li key={`${news.tick}-${news.rival}-${news.kind}`}><span>{month(news.tick)}</span><span>{newsText(t, news)}</span></li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
