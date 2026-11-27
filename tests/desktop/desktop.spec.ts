import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ElectronApplication } from '@playwright/test';

// Runs the packaged Linux application built by `pnpm desktop:dist`.
const executable = process.env.SILICON_EMPIRE_DESKTOP ?? path.resolve('release/linux-unpacked/silicon-empire');
const profile = mkdtempSync(path.join(tmpdir(), 'silicon-empire-profile-'));

async function launch(): Promise<ElectronApplication> {
  // The game follows the system language; the scenario is written in French.
  const args = [`--user-data-dir=${profile}`, '--lang=fr-FR'];
  if (process.getuid?.() === 0) args.push('--no-sandbox');
  return electron.launch({ executablePath: executable, args });
}

test.afterAll(() => rmSync(profile, { recursive: true, force: true }));

test('lance le jeu installé, affiche la version et conserve une sauvegarde entre deux lancements', async () => {
  const first = await launch();
  const page = await first.firstWindow();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  expect(await page.evaluate(() => location.origin)).toBe('app://silicon-empire');
  await expect(page.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
  expect(await page.evaluate(() => typeof window.siliconDesktop?.checkForUpdates)).toBe('function');
  expect(await page.evaluate(() => 'require' in window || 'process' in window)).toBe(false);

  await page.getByLabel('Nom de l’atelier').fill('Atelier de bureau');
  await page.getByRole('radio', { name: /^Classique/ }).check();
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await expect(page.getByRole('region', { name: 'Grille interactive de l’atelier' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer et quitter' }).click();
  await expect(page.getByRole('button', { name: 'Reprendre Atelier de bureau' })).toBeVisible();
  expect(errors).toEqual([]);
  await first.close();

  const second = await launch();
  const reopened = await second.firstWindow();
  await expect(reopened.getByRole('button', { name: 'Reprendre Atelier de bureau' })).toBeVisible();
  await second.close();
});
