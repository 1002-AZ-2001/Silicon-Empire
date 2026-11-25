import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { Dialog } from './shared';
import type { Messages } from '../i18n';
import type { DesktopBridge, InstallFailure, UpdateStatus } from '../../../desktop/bridge';

declare global {
  interface Window {
    /** Present only in the desktop application. */
    readonly siliconDesktop?: DesktopBridge;
  }
}

const RELEASES = 'https://github.com/1002-AZ-2001/Silicon-Empire/releases';

function installFailure(t: Messages, failure: InstallFailure): string {
  return failure.reason === 'failed' ? t.updates.installErrors.failed(failure.code) : t.updates.installErrors[failure.reason];
}

function ManualInstall({ desktop, status, onClose }: {
  desktop: DesktopBridge;
  status: Extract<UpdateStatus, { state: 'manual' }>;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  return (
    <Dialog
      title={t.updates.manualTitle(status.version)}
      onDismiss={onClose}
      actions={<>
        <button type="button" className="button" onClick={() => void desktop.showUpdateFile()}>{t.updates.openFolder}</button>
        <button type="button" className="button" onClick={() => void desktop.installUpdate()}>{t.updates.retry}</button>
        <button type="button" className="button button-primary" onClick={() => {
          void desktop.copyInstallCommand().then(() => setCopied(true));
        }}>{copied ? t.updates.copied : t.updates.copy}</button>
      </>}
    >
      <p>{installFailure(t, status.failure)}</p>
      <p>{t.updates.manualSteps}</p>
      <pre className="install-command">{status.command}</pre>
      <p>{t.updates.manualAgent}</p>
    </Dialog>
  );
}

function DesktopUpdates({ desktop }: { desktop: DesktopBridge }) {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const { t } = useI18n();

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
    return <span className="update-status">{t.updates.checking}</span>;
  }
  switch (status.state) {
    case 'unsupported':
      return <span className="update-status">{t.updates.unsupported}</span>;
    case 'current':
      return (
        <span className="update-status">
          {t.updates.current}
          <button type="button" className="link-button" onClick={() => void desktop.checkForUpdates()}>{t.updates.check}</button>
        </span>
      );
    case 'available':
      return (
        <span className="update-status update-ready">
          {t.updates.available(status.version)}
          <a href={`${RELEASES}/tag/v${status.version}`} target="_blank" rel="noreferrer">{t.updates.notes}</a>
          <button type="button" className="button button-primary" onClick={() => void desktop.downloadUpdate()}>{t.updates.download}</button>
        </span>
      );
    case 'downloading':
      return (
        <span className="update-status">
          {t.updates.downloading(status.version)}
          <progress max={100} value={status.percent} aria-label={t.updates.progress} /> {status.percent}&#8201;%
        </span>
      );
    case 'downloaded':
      return (
        <span className="update-status update-ready">
          {t.updates.ready(status.version)}
          <button type="button" className="button button-primary" onClick={() => void desktop.installUpdate()}>{t.updates.install}</button>
        </span>
      );
    case 'installing':
      return <span className="update-status">{t.updates.installing(status.version)}</span>;
    case 'manual':
      return (
        <span className="update-status text-error">
          {t.updates.manualShort}
          <button type="button" className="button button-primary" onClick={() => setManualOpen(true)}>{t.updates.manualOpen}</button>
          {manualOpen && <ManualInstall desktop={desktop} status={status} onClose={() => setManualOpen(false)} />}
        </span>
      );
    case 'error':
      return (
        <span className="update-status text-error">
          {t.updates.failed} · {t.updates.errors[status.reason]}
          <button type="button" className="link-button" onClick={() => void desktop.checkForUpdates()}>{t.updates.retry}</button>
        </span>
      );
  }
}

/** Game version, and in the desktop application, the update offer. */
export function UpdatePanel() {
  const desktop = window.siliconDesktop;
  const { t } = useI18n();
  return (
    <span className="update-panel">
      <span>{t.version(__APP_VERSION__)}</span>
      {desktop && <DesktopUpdates desktop={desktop} />}
    </span>
  );
}
