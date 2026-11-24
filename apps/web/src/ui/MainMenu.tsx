import { WORKSHOP } from '@silicon-empire/game-data';
import { useEffect, useState } from 'react';
import workshopArt from '../art/workshop-menu.webp';
import { listSaves, loadSave, removeSave } from '../persistence/indexed-saves';
import { MAX_WORKSHOP_NAME } from '../persistence/save-data';
import { Dialog, Icon, money } from './shared';
import { UpdatePanel } from './UpdatePanel';
import type { SaveRecord } from '../persistence/save-data';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export function MainMenu({ onNewGame, onResume }: {
  onNewGame: (name: string) => void;
  onResume: (save: SaveRecord) => void;
}) {
  const [saves, setSaves] = useState<SaveRecord[] | null>(null);
  const [unreadable, setUnreadable] = useState(0);
  const [storageError, setStorageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SaveRecord | null>(null);
  const [deleteError, setDeleteError] = useState('');

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
        if (active) setStorageError('Le stockage local est indisponible.');
      });
    return () => { active = false; };
  }, []);

  async function resume(id: string) {
    setBusy(true);
    setStorageError('');
    try {
      const record = await loadSave(id);
      if (record) {
        onResume(record);
      } else {
        setStorageError('Cette sauvegarde est introuvable ou illisible.');
      }
    } catch {
      setStorageError('Impossible de lire cette sauvegarde locale.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteWorkshop() {
    if (!deleteTarget) return;
    setBusy(true);
    setDeleteError('');
    try {
      await removeSave(deleteTarget.id);
      setSaves(previous => previous?.filter(record => record.id !== deleteTarget.id) ?? []);
      setDeleteTarget(null);
    } catch {
      setDeleteError('Impossible de supprimer cette sauvegarde.');
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
        <span className="menu-identity"><span className="brand-mark"><Icon name="chip" /></span> Jeu de gestion industrielle</span>
        <span className="version">Version {__APP_VERSION__.split('.').slice(0, 2).join('.')}</span>
      </header>

      <main className="menu-main menu-frame">
        <div className="menu-column">
          <h1 className="menu-title">Silicon<br /><span>Empire</span></h1>
          <p className="menu-intro">Construisez votre atelier informatique. Implantez vos équipements et aménagez l’espace à votre rythme.</p>

          <form className="new-game" onSubmit={event => {
            event.preventDefault();
            const name = new FormData(event.currentTarget).get('name');
            onNewGame(typeof name === 'string' && name.trim() ? name.trim() : 'Atelier 01');
          }}>
            <label htmlFor="workshop-name">Nom de l’atelier</label>
            <input id="workshop-name" name="name" placeholder="Atelier 01" maxLength={MAX_WORKSHOP_NAME} autoComplete="off" disabled={busy} />
            <button className="button button-primary new-game-button" disabled={busy}>
              Nouvelle partie <Icon name="arrow" />
            </button>
          </form>

          <section className="save-panel" aria-labelledby="saved-workshops">
            <h2 id="saved-workshops"><Icon name="folder" /> Ateliers enregistrés</h2>
            {storageError && <p role="alert" className="text-error">{storageError}</p>}
            {unreadable > 0 && <p role="status" className="text-error">Sauvegardes illisibles ou incompatibles&#8201;: {unreadable}.</p>}
            {saves === null && !storageError && <p role="status">Lecture des sauvegardes…</p>}
            {saves?.length === 0 && !storageError && <p>Aucun atelier enregistré sur ce navigateur.</p>}
            {saves && saves.length > 0 && (
              <ul className="save-list">
                {saves.map(record => (
                  <li key={record.id} className="save-row">
                    <button
                      type="button"
                      className="save-open"
                      aria-label={`Reprendre ${record.name}`}
                      disabled={busy}
                      onClick={() => void resume(record.id)}
                    >
                      <span className="save-row-info">
                        <strong>{record.name}</strong>
                        <small>{dateFormat.format(record.savedAt)} · {money(record.world.capitalCents)}</small>
                      </span>
                      <Icon name="arrow" />
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-save"
                      title="Supprimer la sauvegarde"
                      aria-label={`Supprimer la sauvegarde « ${record.name} »`}
                      disabled={busy}
                      onClick={() => {
                        setDeleteError('');
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
        <span><Icon name="grid" /> {WORKSHOP.columns} × {WORKSHOP.rows} tuiles</span>
        <span>Capital de départ <strong>{money(WORKSHOP.initialCapitalCents)}</strong></span>
        <UpdatePanel />
      </footer>

      {deleteTarget && (
        <Dialog
          title="Supprimer la sauvegarde ?"
          onDismiss={() => { if (!busy) setDeleteTarget(null); }}
          actions={<>
            <button type="button" className="button" disabled={busy} onClick={() => setDeleteTarget(null)}>Annuler</button>
            <button type="button" className="button button-danger" disabled={busy} onClick={() => void deleteWorkshop()}>Supprimer</button>
          </>}
        >
          <p>La sauvegarde de <strong>{deleteTarget.name}</strong> sera supprimée de ce navigateur.</p>
          {deleteError && <p role="alert" className="text-error">{deleteError}</p>}
        </Dialog>
      )}
    </div>
  );
}
