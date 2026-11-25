import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { InstallFailure } from './bridge';

/**
 * Installation of downloaded .deb and pacman updates.
 *
 * electron-updater runs `pkexec --disable-internal-agent bash -c '…'` synchronously and, for pacman,
 * retries with `pacman -Sy` (a partial upgrade). Without a polkit authentication agent in the session,
 * common with minimal window managers, pkexec exits with 127 and the update fails.
 * The game installs these packages itself, without a shell, and offers the exact manual command on failure.
 */
export type SystemPackage = 'deb' | 'pacman';

const PKEXEC = '/usr/bin/pkexec';

/** Package format of the running installation, written by electron-builder; null for AppImage and Windows. */
export function systemPackageType(resourcesPath: string, env: NodeJS.ProcessEnv): SystemPackage | null {
  if (env.APPIMAGE) return null;
  try {
    const type = readFileSync(path.join(resourcesPath, 'package-type'), 'utf8').trim();
    return type === 'deb' || type === 'pacman' ? type : null;
  } catch {
    return null;
  }
}

export function installCommand(type: SystemPackage, file: string): string[] {
  return type === 'pacman'
    ? ['/usr/bin/pacman', '-U', '--noconfirm', file]
    : ['/usr/bin/apt-get', 'install', '-y', '--allow-downgrades', file];
}

/** The same command for a terminal, each argument single-quoted. */
export function terminalCommand(command: readonly string[]): string {
  return ['sudo', ...command.map(part => `'${part.replaceAll("'", "'\\''")}'`)].join(' ');
}

/** Exit codes from the pkexec manual: 126 when the dialog is dismissed, 127 when no authorization is obtained. */
export function failureReason(error: unknown): InstallFailure {
  const code = (error as { code?: unknown }).code;
  if (code === 'ENOENT') return { reason: 'no-pkexec' };
  if (code === 126) return { reason: 'cancelled' };
  if (code === 127) return { reason: 'no-agent' };
  return typeof code === 'number' ? { reason: 'failed', code } : { reason: 'not-started' };
}

/** Runs the installation as root through pkexec, or directly when the game already runs as root. */
export function runInstall(command: readonly string[], asRoot: boolean): Promise<void> {
  const [program, ...args] = asRoot ? command : [PKEXEC, ...command];
  return new Promise((resolve, reject) => {
    if (!program) {
      reject(new Error('Commande vide.'));
      return;
    }
    execFile(program, args, { timeout: 15 * 60_000 }, error => {
      if (error) reject(error);
      else resolve();
    });
  });
}
