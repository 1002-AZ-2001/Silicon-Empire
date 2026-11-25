import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterAll, describe, expect, it } from 'vitest';

// The desktop code is CommonJS; `pnpm test` compiles it to build/desktop before running Vitest.
const { failureReason, installCommand, systemPackageType, terminalCommand } = createRequire(import.meta.url)(
  '../../build/desktop/system-install.cjs',
) as {
  failureReason(error: unknown): { reason: string; code?: number };
  installCommand(type: 'deb' | 'pacman', file: string): string[];
  systemPackageType(resourcesPath: string, env: Record<string, string>): 'deb' | 'pacman' | null;
  terminalCommand(command: readonly string[]): string;
};

const resources = mkdtempSync(path.join(tmpdir(), 'silicon-empire-resources-'));
afterAll(() => rmSync(resources, { recursive: true, force: true }));

describe('installation des paquets système', () => {
  it('reconnaît les paquets deb et pacman, mais pas l’AppImage ni les autres formats', () => {
    expect(systemPackageType(resources, {})).toBeNull();
    writeFileSync(path.join(resources, 'package-type'), 'pacman\n');
    expect(systemPackageType(resources, {})).toBe('pacman');
    expect(systemPackageType(resources, { APPIMAGE: '/tmp/jeu.AppImage' })).toBeNull();
    writeFileSync(path.join(resources, 'package-type'), 'deb');
    expect(systemPackageType(resources, {})).toBe('deb');
    writeFileSync(path.join(resources, 'package-type'), 'rpm');
    expect(systemPackageType(resources, {})).toBeNull();
  });

  it('installe par chemins absolus, sans resynchroniser pacman', () => {
    expect(installCommand('pacman', '/c/a.pacman')).toEqual(['/usr/bin/pacman', '-U', '--noconfirm', '/c/a.pacman']);
    expect(installCommand('deb', '/c/a.deb')).toEqual(['/usr/bin/apt-get', 'install', '-y', '--allow-downgrades', '/c/a.deb']);
  });

  it('cite chaque argument pour le terminal, y compris les espaces et apostrophes', () => {
    const file = "/home/joueuse/l'atelier $HOME/Silicon Empire.pacman";
    const command = terminalCommand(installCommand('pacman', file));
    expect(command).toBe("sudo '/usr/bin/pacman' '-U' '--noconfirm' '/home/joueuse/l'\\''atelier $HOME/Silicon Empire.pacman'");
    const words = execFileSync('/bin/sh', ['-c', `set -- ${command.slice('sudo '.length)}; printf '%s\\n' "$@"`], { encoding: 'utf8' });
    expect(words.trim().split('\n')).toEqual(['/usr/bin/pacman', '-U', '--noconfirm', file]);
  });

  it('explique les codes de sortie de pkexec', () => {
    expect(failureReason({ code: 127 })).toEqual({ reason: 'no-agent' });
    expect(failureReason({ code: 126 })).toEqual({ reason: 'cancelled' });
    expect(failureReason({ code: 'ENOENT' })).toEqual({ reason: 'no-pkexec' });
    expect(failureReason({ code: 1 })).toEqual({ reason: 'failed', code: 1 });
    expect(failureReason(new Error('?'))).toEqual({ reason: 'not-started' });
  });
});
