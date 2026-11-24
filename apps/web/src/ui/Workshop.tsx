import { demolitionRefund, Simulation } from '@silicon-empire/simulation';
import { MACHINES } from '@silicon-empire/game-data';
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import { createWorkshopControls } from '../game/controls';
import { writeSave } from '../persistence/indexed-saves';
import { SAVE_VERSION } from '../persistence/save-data';
import { ConstructionBar, getShortcut } from './ConstructionBar';
import { Inspector } from './Inspector';
import { Dialog, Icon, money } from './shared';
import type { World } from '@silicon-empire/simulation';

const WorkshopViewport = lazy(() => import('../game/WorkshopViewport'));

export interface WorkshopSession {
  id: string;
  name: string;
  createdAt: number;
  savedAt: number | null;
  world: World;
}

export function Workshop({ session, onMenu }: { session: WorkshopSession; onMenu: () => void }) {
  const [simulation] = useState(() => new Simulation(session.world));
  const [controls] = useState(() => createWorkshopControls(simulation));
  const world = useSyncExternalStore(simulation.subscribe, simulation.getSnapshot);
  const demolitionId = useStore(controls.store, state => state.demolitionId);
  const [savedWorld, setSavedWorld] = useState<World | null>(session.savedAt === null ? null : session.world);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [leaveDialog, setLeaveDialog] = useState(false);
  const saveInProgress = useRef(false);
  const lastSavedAt = useRef(session.savedAt ?? session.createdAt);
  const dirty = savedWorld !== world;
  const toDemolish = world.machines.find(machine => machine.id === demolitionId);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      const tool = getShortcut(event.code.startsWith('Digit') ? event.code.slice(5) : key);
      if (key === 'escape') {
        event.preventDefault();
        controls.selectTool('inspect');
      } else if (key === 'r') {
        event.preventDefault();
        controls.rotate();
      } else if (tool) {
        event.preventDefault();
        controls.selectTool(tool);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [controls]);

  async function save(leaveAfter: boolean) {
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setSaveError('');
    const snapshot = simulation.getSnapshot();
    const savedAt = Math.max(Date.now(), lastSavedAt.current);
    try {
      await writeSave({
        version: SAVE_VERSION,
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        savedAt,
        world: snapshot,
      });
      lastSavedAt.current = savedAt;
      setSavedWorld(snapshot);
      if (leaveAfter) onMenu();
    } catch {
      setSaveError('Impossible d’enregistrer cet atelier dans le navigateur.');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }

  function openMenu() {
    if (saveInProgress.current) return;
    if (simulation.getSnapshot() === savedWorld) {
      onMenu();
    } else {
      setLeaveDialog(true);
    }
  }

  return (
    <div className="workshop-shell">
      <header className="workshop-header">
        <div className="workshop-brand"><span className="brand-mark"><Icon name="chip" /></span><span>Silicon<br />Empire</span></div>
        <div className="workshop-metrics">
          <div className="metric">
            <span className="metric-label">Capital disponible</span>
            <strong className="capital" aria-label="Capital disponible">{money(world.capitalCents)}</strong>
          </div>
          <div className="metric equipment-count">
            <span className="metric-label">Équipements</span>
            <strong aria-label="Équipements installés">{world.machines.length}</strong>
          </div>
        </div>
        <div className="workshop-actions">
          <span className={`save-status${saveError ? ' text-error' : ''}`} role="status">
            {saveError || (saving ? 'Enregistrement…' : dirty ? 'À enregistrer' : 'Atelier enregistré')}
          </span>
          <button type="button" className="button save-button" disabled={saving} onClick={() => void save(false)}>
            <Icon name="save" /> Enregistrer
          </button>
          <button type="button" className="button menu-button" disabled={saving} onClick={openMenu}>
            <Icon name="back" /> Menu
          </button>
        </div>
      </header>

      <main className="workspace-grid">
        <Suspense fallback={<div className="map-panel map-loading" role="status">Chargement de l’atelier…</div>}>
          <WorkshopViewport simulation={simulation} controls={controls} name={session.name} />
        </Suspense>
        <Inspector controls={controls} world={world} />
      </main>

      <ConstructionBar controls={controls} />

      {toDemolish && (
        <Dialog
          title="Démolir cet équipement ?"
          onDismiss={() => controls.store.setState({ demolitionId: null })}
          actions={<>
            <button type="button" className="button" onClick={() => controls.store.setState({ demolitionId: null })}>Annuler</button>
            <button type="button" className="button button-danger" onClick={controls.confirmDemolition}>Confirmer la démolition</button>
          </>}
        >
          <p>{MACHINES[toDemolish.type].name} sera retiré. Le remboursement de <strong>{money(demolitionRefund(toDemolish))}</strong> sera crédité à votre atelier.</p>
        </Dialog>
      )}

      {leaveDialog && (
        <Dialog
          title="Revenir au menu ?"
          onDismiss={() => { if (!saving) setLeaveDialog(false); }}
          actions={<>
            <button type="button" className="button" disabled={saving} onClick={() => setLeaveDialog(false)}>Annuler</button>
            <button type="button" className="button" disabled={saving} onClick={onMenu}>Quitter sans sauvegarder</button>
            <button type="button" className="button button-primary" disabled={saving} onClick={() => void save(true)}>Enregistrer et quitter</button>
          </>}
        >
          <p>Enregistrez l’atelier pour reprendre la partie depuis cet état.</p>
          {saveError && <p role="alert" className="text-error">{saveError}</p>}
        </Dialog>
      )}
    </div>
  );
}
