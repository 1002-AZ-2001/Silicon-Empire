import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { UpdateStatus } from './bridge';

/**
 * The game is served from a fixed privileged origin, app://silicon-empire,
 * so IndexedDB saves stay attached to the same origin across launches and updates.
 */
const SCHEME = 'app';
const HOST = 'silicon-empire';
const ORIGIN = `${SCHEME}://${HOST}`;
const SITE = path.join(__dirname, '..', '..', 'dist');
const RELEASES = 'https://github.com/1002-AZ-2001/Silicon-Empire/releases';

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let window: BrowserWindow | null = null;
let status: UpdateStatus = app.isPackaged ? { state: 'idle' } : { state: 'unsupported' };

function publish(next: UpdateStatus) {
  status = next;
  window?.webContents.send('update:status', status);
}

function serveSite() {
  protocol.handle(SCHEME, request => {
    const url = new URL(request.url);
    const file = path.normalize(path.join(SITE, decodeURIComponent(url.pathname)));
    if (url.host !== HOST || !file.startsWith(SITE + path.sep)) {
      return new Response('Introuvable', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: 'Silicon Empire',
    backgroundColor: '#101817',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  window.once('ready-to-show', () => window?.show());
  // Only the release page opens, in the system browser. Nothing else leaves the game origin.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(`${RELEASES}/`)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(`${ORIGIN}/`)) event.preventDefault();
  });
  window.on('closed', () => { window = null; });
  void window.loadURL(`${ORIGIN}/index.html`);
}

/** Short reason for the menu. Raw updater errors can contain whole HTTP responses. */
function describeError(error: Error): string {
  if (/\b404\b/.test(error.message)) return 'Aucune version publiée trouvée sur GitHub.';
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ETIMEDOUT|net::ERR_/.test(error.message)) return 'Connexion à GitHub impossible.';
  return error.message.split('\n')[0]?.slice(0, 160) ?? 'Erreur inconnue.';
}

/** Updates are offered, then downloaded and installed only on the player's request. */
function setUpUpdates() {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('update:status', () => status);

  if (!app.isPackaged) {
    for (const channel of ['update:check', 'update:download', 'update:install']) ipcMain.handle(channel, () => undefined);
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
  autoUpdater.on('update-available', info => publish({ state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => publish({ state: 'current' }));
  autoUpdater.on('download-progress', progress => {
    if (status.state === 'available' || status.state === 'downloading') {
      publish({ state: 'downloading', version: status.version, percent: Math.floor(progress.percent) });
    }
  });
  autoUpdater.on('update-downloaded', info => publish({ state: 'downloaded', version: info.version }));
  autoUpdater.on('error', error => publish({ state: 'error', message: describeError(error) }));

  ipcMain.handle('update:check', async () => {
    if (status.state === 'downloading' || status.state === 'downloaded' || status.state === 'checking') return;
    await autoUpdater.checkForUpdates().catch(() => undefined);
  });
  ipcMain.handle('update:download', async () => {
    if (status.state !== 'available') return;
    publish({ state: 'downloading', version: status.version, percent: 0 });
    await autoUpdater.downloadUpdate().catch(() => undefined);
  });
  ipcMain.handle('update:install', () => {
    if (status.state === 'downloaded') autoUpdater.quitAndInstall();
  });
}

if (!app.requestSingleInstanceLock()) {
  // A second window would share the same saves; focus the first one instead.
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  app.on('window-all-closed', () => app.quit());
  void app.whenReady().then(() => {
    serveSite();
    setUpUpdates();
    createWindow();
  });
}
