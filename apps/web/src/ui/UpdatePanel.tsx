import { useEffect, useState } from 'react';
import { Dialog } from './shared';
import type { DesktopBridge, UpdateStatus } from '../../../desktop/bridge';

declare global {
  interface Window {
    /** Present only in the desktop application. */
    readonly siliconDesktop?: DesktopBridge;
  }
}

const RELEASES = 'https://github.com/1002-AZ-2001/Silicon-Empire/releases';

function ManualInstall({ desktop, status, onClose }: {
  desktop: DesktopBridge;
  status: Extract<UpdateStatus, { state: 'manual' }>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog
      title={`Installer la version ${status.version}`}
      onDismiss={onClose}
      actions={<>
        <button type="button" className="button" onClick={() => void desktop.showUpdateFile()}>Ouvrir le dossier</button>
        <button type="button" className="button" onClick={() => void desktop.installUpdate()}>Réessayer</button>
        <button type="button" className="button button-primary" onClick={() => {
          void desktop.copyInstallCommand().then(() => setCopied(true));
        }}>{copied ? 'Commande copiée' : 'Copier la commande'}</button>
      </>}
    >
      <p>{status.reason}</p>
      <p>La mise à jour est téléchargée. Pour l’installer, exécutez cette commande dans un terminal, puis relancez le jeu :</p>
      <pre className="install-command">{status.command}</pre>
      <p>Pour que le jeu installe lui-même les prochaines mises à jour, démarrez un agent d’authentification polkit dans votre session. Le tutoriel d’installation en indique plusieurs.</p>
    </Dialog>
  );
}

function DesktopUpdates({ desktop }: { desktop: DesktopBridge }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = desktop.onUpdateStatus(next => {
      setStatus(next);
      setManualOpen(next.state === 'manual');
    });
    void desktop.getUpdateStatus().then(current => {
      setStatus(current);
      if (current.state === 'idle') void desktop.checkForUpdates();
    });
    return unsubscribe;
  }, [desktop]);

  if (!status || status.state === 'idle' || status.state === 'checking') {
    return <span className="update-status">Recherche de mises à jour…</span>;
  }
  switch (status.state) {
    case 'unsupported':
      return <span className="update-status">Mises à jour disponibles dans le jeu installé</span>;
    case 'current':
      return (
        <span className="update-status">
          Jeu à jour
          <button type="button" className="link-button" onClick={() => void desktop.checkForUpdates()}>Vérifier</button>
        </span>
      );
    case 'available':
      return (
        <span className="update-status update-ready">
          Version {status.version} disponible
          <a href={`${RELEASES}/tag/v${status.version}`} target="_blank" rel="noreferrer">Nouveautés</a>
          <button type="button" className="button button-primary" onClick={() => void desktop.downloadUpdate()}>Télécharger</button>
        </span>
      );
    case 'downloading':
      return (
        <span className="update-status">
          Téléchargement de la version {status.version}
          <progress max={100} value={status.percent} aria-label="Téléchargement de la mise à jour" /> {status.percent}&#8201;%
        </span>
      );
    case 'downloaded':
      return (
        <span className="update-status update-ready">
          Version {status.version} prête
          <button type="button" className="button button-primary" onClick={() => void desktop.installUpdate()}>Redémarrer pour installer</button>
        </span>
      );
    case 'installing':
      return <span className="update-status">Installation de la version {status.version}…</span>;
    case 'manual':
      return (
        <span className="update-status text-error">
          Installation automatique impossible
          <button type="button" className="button button-primary" onClick={() => setManualOpen(true)}>Installer manuellement</button>
          {manualOpen && <ManualInstall desktop={desktop} status={status} onClose={() => setManualOpen(false)} />}
        </span>
      );
    case 'error':
      return (
        <span className="update-status text-error">
          Mise à jour impossible&#8201;: {status.message}
          <button type="button" className="link-button" onClick={() => void desktop.checkForUpdates()}>Réessayer</button>
        </span>
      );
  }
}

/** Game version, and in the desktop application, the update offer. */
export function UpdatePanel() {
  const desktop = window.siliconDesktop;
  return (
    <span className="update-panel">
      <span>Version {__APP_VERSION__}</span>
      {desktop && <DesktopUpdates desktop={desktop} />}
    </span>
  );
}
