/** Update state reported by the desktop application to the game menu. */
export type UpdateStatus =
  | { readonly state: 'unsupported' }
  | { readonly state: 'idle' }
  | { readonly state: 'checking' }
  | { readonly state: 'current' }
  | { readonly state: 'available'; readonly version: string }
  | { readonly state: 'downloading'; readonly version: string; readonly percent: number }
  | { readonly state: 'downloaded'; readonly version: string }
  | { readonly state: 'installing'; readonly version: string }
  /** Automatic installation failed: the player can run `command` in a terminal. */
  | { readonly state: 'manual'; readonly version: string; readonly reason: string; readonly command: string }
  | { readonly state: 'error'; readonly message: string };

/** API exposed to the game page as `window.siliconDesktop` by the desktop preload script. */
export interface DesktopBridge {
  getVersion(): Promise<string>;
  getUpdateStatus(): Promise<UpdateStatus>;
  checkForUpdates(): Promise<void>;
  downloadUpdate(): Promise<void>;
  installUpdate(): Promise<void>;
  copyInstallCommand(): Promise<void>;
  showUpdateFile(): Promise<void>;
  onUpdateStatus(listener: (status: UpdateStatus) => void): () => void;
}
