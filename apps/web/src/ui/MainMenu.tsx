import { WORKSHOP } from '@silicon-empire/game-data';
import { useEffect, useState } from 'react';
import workshopArt from '../art/workshop-menu.webp';
import { listSaves, loadSave, removeSave } from '../persistence/indexed-saves';
import { MAX_WORKSHOP_NAME } from '../persistence/save-data';
import { LOCALES, LOCALE_NAMES, setLocale, useI18n } from '../i18n';
import { Dialog, Icon } from './shared';
import { UpdatePanel } from './UpdatePanel';
import type { SaveRecord } from '../persistence/save-data';

export function MainMenu({ onNewGame, onResume }: {
  onNewGame: (name: string, sandbox: boolean) => void;
  onResume: (save: SaveRecord) => void;
}) {
  const [saves, setSaves] = useState<SaveRecord[] | null>(null);
  const [unreadable, setUnreadable] = useState(0);
  const [storageError, setStorageError] = useState<'storageUnavailable' | 'saveMissing' | 'readFailed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaveRecord | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const { t, money, date, locale } = useI18n();

  useEffect(() => {
    let active = true;
    listSaves()
      .then(result => {
        if (active) {
          setSaves(result.saves);
          setUnreadable(result.unreadable);
        }
      })
      .catch(() => {
        if (active) setStorageError('storageUnavailable');
      });
    return () => { active = false; };
  }, []);

  async function resume(id: string) {
    setBusy(true);
    setStorageError(null);
    try {
      const record = await loadSave(id);
      if (record) {
        onResume(record);
      } else {
        setStorageError('saveMissing');
      }
    } catch {
      setStorageError('readFailed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkshop() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteFailed(false);
    try {
      await removeSave(deleteTarget.id);
      setSaves(previous => previous?.filter(record => record.id !== deleteTarget.id) ?? []);
      setDeleteTarget(null);
    } catch {
      setDeleteFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="menu-shell">
      <div className="menu-visual" aria-hidden="true">
        <img src={workshopArt} alt="" fetchPriority="high" />
      </div>

      <header className="menu-header menu-frame">
        <span className="menu-identity"><span className="brand-mark"><Icon name="chip" /></span> {t.tagline}</span>
        <span className="menu-header-tools">
          <label className="language-select">
            <span>{t.menu.language}</span>
            <select value={locale} onChange={event => setLocale(event.target.value as typeof locale)}>
              {LOCALES.map(option => <option key={option} value={option} lang={option}>{LOCALE_NAMES[option]}</option>)}
            </select>
          </label>
          <span className="version">{t.version(__APP_VERSION__.split('.').slice(0, 2).join('.'))}</span>
        </span>
      </header>

      <main className="menu-main menu-frame">
        <div className="menu-column">
          <h1 className="menu-title">Silicon<br /><span>Empire</span></h1>
          <p className="menu-intro">{t.menu.intro}</p>

          <form className="new-game" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = form.get('name');
            onNewGame(typeof name === 'string' && name.trim() ? name.trim() : t.menu.defaultName, form.get('sandbox') === 'on');
          }}>
            <label htmlFor="workshop-name">{t.menu.nameLabel}</label>
            <input id="workshop-name" name="name" placeholder={t.menu.defaultName} maxLength={MAX_WORKSHOP_NAME} autoComplete="off" disabled={busy} />
            <label className="sandbox-option">
              <input type="checkbox" name="sandbox" disabled={busy} />
              <span><strong>{t.menu.sandbox}</strong> {t.menu.sandboxHint}</span>
            </label>
            <button className="button button-primary new-game-button" disabled={busy}>
              {t.menu.newGame} <Icon name="arrow" />
            </button>
          </form>

          <section className="save-panel" aria-labelledby="saved-workshops">
            <h2 id="saved-workshops"><Icon name="folder" /> {t.menu.saved}</h2>
            {storageError && <p role="alert" className="text-error">{t.menu[storageError]}</p>}
            {unreadable > 0 && <p role="status" className="text-error">{t.menu.unreadable(unreadable)}</p>}
            {saves === null && !storageError && <p role="status">{t.menu.loading}</p>}
            {saves?.length === 0 && !storageError && <p>{t.menu.empty}</p>}
            {saves && saves.length > 0 && (
              <ul className="save-list">
                {saves.map(record => (
                  <li key={record.id} className="save-row">
                    <button
                      type="button"
                      className="save-open"
                      aria-label={t.menu.resume(record.name)}
                      disabled={busy}
                      onClick={() => void resume(record.id)}
                    >
                      <span className="save-row-info">
                        <strong>{record.name}{record.world.progress.sandbox && <em className="save-badge">{t.menu.sandboxBadge}</em>}</strong>
                        <small>{date(record.savedAt)} · {money(record.world.capitalCents)}</small>
                      </span>
                      <Icon name="arrow" />
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-save"
                      title={t.menu.deleteSave}
                      aria-label={t.menu.deleteNamed(record.name)}
                      disabled={busy}
                      onClick={() => {
                        setDeleteFailed(false);
                        setDeleteTarget(record);
                      }}
                    ><Icon name="trash" /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <footer className="menu-footer menu-frame">
        <span><Icon name="grid" /> {t.menu.tiles(WORKSHOP.columns, WORKSHOP.rows)}</span>
        <span>{t.menu.startingCapital} <strong>{money(WORKSHOP.initialCapitalCents)}</strong></span>
        <UpdatePanel />
      </footer>

      {deleteTarget && (
        <Dialog
          title={t.menu.deleteTitle}
          onDismiss={() => { if (!busy) setDeleteTarget(null); }}
          actions={<>
            <button type="button" className="button" disabled={busy} onClick={() => setDeleteTarget(null)}>{t.common.cancel}</button>
            <button type="button" className="button button-danger" disabled={busy} onClick={() => void deleteWorkshop()}>{t.common.delete}</button>
          </>}
        >
          <p>{t.menu.deleteBody(deleteTarget.name)}</p>
          {deleteFailed && <p role="alert" className="text-error">{t.menu.deleteFailed}</p>}
        </Dialog>
      )}
    </div>
  );
}
