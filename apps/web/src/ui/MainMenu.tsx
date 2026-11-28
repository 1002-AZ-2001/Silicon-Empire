import { LAND, START_YEARS, WORKSHOP, eraOfYear } from '@silicon-empire/game-data';
import { useEffect, useRef, useState } from 'react';
import workshopArt from '../art/workshop-menu.webp';
import { BACKUP_LIMIT_BYTES, downloadBackup, parseBackup } from '../persistence/backup';
import { addSave, listSaves, loadSave, removeSave } from '../persistence/indexed-saves';
import { MAX_WORKSHOP_NAME, createSaveId } from '../persistence/save-data';
import { CURRENCIES, LOCALES, LOCALE_NAMES, resolveCurrency, setCurrency, setLocale, useCurrencyChoice, useI18n } from '../i18n';
import type { StartYear } from '@silicon-empire/game-data';
import type { GameMode } from '@silicon-empire/simulation';
import type { CurrencyChoice } from '../i18n';
import { Dialog, Icon } from './shared';
import { UpdatePanel } from './UpdatePanel';
import type { SaveRecord } from '../persistence/save-data';

export function MainMenu({ onNewGame, onResume }: {
  onNewGame: (name: string, mode: GameMode, startYear: StartYear) => void;
  onResume: (save: SaveRecord) => void;
}) {
  const [saves, setSaves] = useState<SaveRecord[] | null>(null);
  const [unreadable, setUnreadable] = useState(0);
  const [storageError, setStorageError] = useState<'storageUnavailable' | 'saveMissing' | 'readFailed' | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaveRecord | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [backupStatus, setBackupStatus] = useState<'invalid' | 'tooLarge' | 'failed' | 'imported' | null>(null);
  const filePicker = useRef<HTMLInputElement>(null);
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

  async function importWorkshop(file: File) {
    setBackupStatus(null);
    if (file.size > BACKUP_LIMIT_BYTES) {
      setBackupStatus('tooLarge');
      return;
    }
    setBusy(true);
    try {
      const original = parseBackup(await file.text());
      if (!original) {
        setBackupStatus('invalid');
        return;
      }
      const name = original.name.slice(0, MAX_WORKSHOP_NAME - t.backup.copySuffix.length).trimEnd() + t.backup.copySuffix;
      const record = { ...original, id: createSaveId(), name, savedAt: Math.max(Date.now(), original.createdAt) };
      await addSave(record);
      setSaves(previous => [record, ...(previous ?? [])]);
      setStorageError(null);
      setBackupStatus('imported');
    } catch {
      setBackupStatus('failed');
    } finally {
      setBusy(false);
    }
  }

  async function exportWorkshop(id: string) {
    setBackupStatus(null);
    setBusy(true);
    try {
      const record = await loadSave(id);
      if (!record) setBackupStatus('invalid');
      else if (!downloadBackup(record)) setBackupStatus('tooLarge');
    } catch {
      setBackupStatus('failed');
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
        <div className="menu-settings">
          <label className="language-select">
            <span>{t.menu.language}</span>
            <select value={locale} onChange={event => setLocale(event.target.value as typeof locale)}>
              {LOCALES.map(option => <option key={option} value={option} lang={option}>{LOCALE_NAMES[option]}</option>)}
            </select>
          </label>
          <CurrencySelect />
        </div>
      </header>

      <main className="menu-main menu-frame">
        <div className="menu-column">
          <h1 className="menu-title">Silicon<br /><span>Empire</span></h1>
          <p className="menu-intro">{t.menu.intro}</p>

          <form className="new-game" onSubmit={event => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = form.get('name');
            const mode = form.get('mode');
            const year = START_YEARS.find(option => String(option) === form.get('startYear')) ?? START_YEARS[0];
            onNewGame(
              typeof name === 'string' && name.trim() ? name.trim() : t.menu.defaultName,
              mode === 'sandbox' || mode === 'progression' ? mode : 'career',
              year,
            );
          }}>
            <label htmlFor="workshop-name">{t.menu.nameLabel}</label>
            <input id="workshop-name" name="name" placeholder={t.menu.defaultName} maxLength={MAX_WORKSHOP_NAME} autoComplete="off" disabled={busy} />
            <fieldset className="mode-options">
              <legend>{t.menu.mode}</legend>
              {(['career', 'progression', 'sandbox'] as const).map(mode => (
                <label className="sandbox-option" key={mode}>
                  <input type="radio" name="mode" value={mode} defaultChecked={mode === 'career'} disabled={busy} />
                  <span><strong>{t.menu.modes[mode].name}</strong> {t.menu.modes[mode].hint}</span>
                </label>
              ))}
            </fieldset>
            <label className="start-year">
              <span>{t.menu.startYear}</span>
              <select name="startYear" defaultValue={START_YEARS[0]} disabled={busy}>
                {START_YEARS.map(year => (
                  <option key={year} value={year}>{t.menu.startYearOption(year, t.eras.names[eraOfYear(year)])}</option>
                ))}
              </select>
              <small>{t.menu.startYearHint}</small>
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
            {backupStatus && <p role={backupStatus === 'imported' ? 'status' : 'alert'}
              className={backupStatus === 'imported' ? undefined : 'text-error'}>{t.backup[backupStatus]}</p>}
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
                        <strong>
                          {record.name}
                          {record.world.progress.sandbox && <em className="save-badge">{t.menu.sandboxBadge}</em>}
                          {record.world.progress.career && <em className="save-badge">{t.menu.careerBadge}</em>}
                        </strong>
                        <small>{date(record.savedAt)} · {money(record.world.capitalCents)}</small>
                      </span>
                      <Icon name="arrow" />
                    </button>
                    <button type="button" className="icon-button save-action" title={t.backup.export}
                      aria-label={`${t.backup.export} · ${record.name}`} disabled={busy} onClick={() => void exportWorkshop(record.id)}>
                      <Icon name="save" />
                    </button>
                    <button
                      type="button"
                      className="icon-button save-action delete-save"
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
            <div className="backup-actions">
              <input ref={filePicker} type="file" accept=".json,application/json" hidden aria-label={t.backup.file}
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void importWorkshop(file);
                }} />
              <button type="button" className="button" disabled={busy || saves === null} onClick={() => filePicker.current?.click()}>
                {t.backup.import}
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="menu-footer menu-frame">
        <span><Icon name="grid" /> {t.menu.tiles(LAND.parcelSize * 2, LAND.parcelSize * 2)}</span>
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

function CurrencySelect() {
  const { t, locale, currencyName } = useI18n();
  const choice = useCurrencyChoice();
  return (
    <label className="language-select">
      <span>{t.menu.currency}</span>
      <select value={choice} onChange={event => setCurrency(event.target.value as CurrencyChoice)}>
        <option value="auto">{t.menu.currencyAuto(currencyName(resolveCurrency(locale, 'auto')))}</option>
        {CURRENCIES.map(code => <option key={code} value={code}>{currencyName(code)}</option>)}
      </select>
    </label>
  );
}
