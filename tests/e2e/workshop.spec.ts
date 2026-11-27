import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const capital = (page: Page) => page.getByLabel('Capital disponible', { exact: true });
const equipment = (page: Page) => page.getByLabel('Équipements installés', { exact: true });
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspection' });
const canvas = (page: Page) => page.getByRole('region', { name: 'Grille interactive de l’atelier' });
const coordinates = (page: Page) => page.getByLabel('Case survolée');
/** Value of the Orientation row in the inspector (ports also list directions). */
const orientation = (page: Page) => inspector(page).locator('.machine-stats > div', { has: page.getByText('Orientation', { exact: true }) }).locator('dd');
const euros = (amount: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(amount);

/** Sandbox games unlock every building; `progression: true` starts the classic mode at tier 0; `career` starts from zero. */
async function startWorkshop(page: Page, name: string, { progression = false, career = false } = {}) {
  await page.getByLabel('Nom de l’atelier').fill(name);
  await page.getByRole('radio', { name: career ? /^Carrière/ : progression ? /^Classique/ : /^Bac à sable/ }).check();
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await expect(canvas(page)).toBeVisible();
}

async function resumeFixture(page: Page, saved: { name: string } & Record<string, unknown>) {
  await page.goto('/');
  await expect(page.getByText('Aucun atelier enregistré')).toBeVisible();
  await page.evaluate(value => new Promise<void>((resolve, reject) => {
    const opening = indexedDB.open('silicon-empire', 1);
    opening.onerror = () => reject(opening.error);
    opening.onsuccess = () => {
      const db = opening.result;
      const transaction = db.transaction('workshops', 'readwrite');
      transaction.objectStore('workshops').put(value);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  }), saved);
  await page.reload();
  await page.getByRole('button', { name: `Reprendre ${saved.name}` }).click();
  await expect(canvas(page)).toBeVisible();
}

async function tileAtCenterZoom(page: Page, x: number, y: number) {
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('La grille est invisible.');
  return {
    x: Math.floor(box.x + box.width / 2 + (x + 0.5 - 32) * 32),
    y: Math.floor(box.y + box.height / 2 + (y + 0.5 - 32) * 32),
  };
}

async function clickTile(page: Page, x: number, y: number) {
  const point = await tileAtCenterZoom(page, x, y);
  await page.mouse.click(point.x, point.y);
}

async function readPixel(page: Page, screenX: number, screenY: number) {
  return canvas(page).evaluate((node: HTMLCanvasElement, point) => {
    const bounds = node.getBoundingClientRect();
    const x = Math.floor((point.x - bounds.left) * node.width / bounds.width);
    const y = Math.floor((point.y - bounds.top) * node.height / bounds.height);
    const pixel = node.getContext('2d')?.getImageData(x, y, 1, 1).data;
    if (!pixel) throw new Error('Pixel de la grille illisible.');
    return Array.from(pixel);
  }, { x: screenX, y: screenY });
}

test('construit et pivote sur la grille, refuse une collision et inspecte toute l’emprise', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await startWorkshop(page, 'Atelier du Nord');
  await expect(capital(page)).toHaveText(euros(25_000));
  await expect(equipment(page)).toHaveText('0');
  const point = await tileAtCenterZoom(page, 32, 32);
  await expect.poll(async () => (await readPixel(page, point.x, point.y))[3]).toBe(255);
  const floor = await readPixel(page, point.x, point.y);

  await page.getByRole('button', { name: /^Banc de test/ }).click();
  await page.mouse.move(point.x, point.y);
  await expect(inspector(page).getByText('Placement possible')).toBeVisible();
  await expect.poll(() => readPixel(page, point.x, point.y)).not.toEqual(floor);
  await page.keyboard.press('r');
  await expect(orientation(page)).toHaveText('Est');
  await expect(inspector(page).getByText('1 × 2')).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(capital(page)).toHaveText(euros(22_600));
  await expect(equipment(page)).toHaveText('1');
  await expect(inspector(page).getByText(/cases sont déjà occupées/).first()).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(inspector(page).getByRole('status')).toHaveText(/cases sont déjà occupées/);
  await expect(capital(page)).toHaveText(euros(22_600));

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Inspecter/ })).toHaveAttribute('aria-pressed', 'true');
  await clickTile(page, 32, 33);
  await expect(inspector(page).getByRole('heading', { name: 'Banc de test' })).toBeVisible();
  await expect(inspector(page).getByText('33, 33')).toBeVisible();
  await expect(orientation(page)).toHaveText('Est');
  await page.getByRole('button', { name: /^Pivoter/ }).click();
  await expect(orientation(page)).toHaveText('Sud');
  await expect(inspector(page).getByText('2 × 1')).toBeVisible();
  await expect(capital(page)).toHaveText(euros(22_600));
  expect(pageErrors).toEqual([]);
});

test('zoome sous le pointeur, recentre et déplace la caméra sans construire pendant un glisser', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Vue de l’atelier');
  const point = await tileAtCenterZoom(page, 36, 34);
  await page.mouse.move(point.x, point.y);
  await expect(coordinates(page)).toHaveText('X 37 / Y 35');
  await page.mouse.wheel(0, -120);
  await expect(page.getByLabel('Zoom', { exact: true })).not.toHaveText(/^100/);
  await expect(coordinates(page)).toHaveText('X 37 / Y 35');
  await page.getByRole('button', { name: 'Recentrer la carte' }).click();
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveText(/^100/);

  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: /^Stockage/ })).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.move(point.x, point.y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(point.x - 96, point.y, { steps: 6 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.move(point.x, point.y);
  await expect(coordinates(page)).toHaveText('X 40 / Y 35');
  await expect(equipment(page)).toHaveText('0');

  await page.keyboard.down('z');
  try {
    await expect(coordinates(page)).not.toHaveText('X 40 / Y 35');
  } finally {
    await page.keyboard.up('z');
  }
  await page.getByRole('button', { name: 'Recentrer la carte' }).click();
  await page.mouse.move(point.x, point.y);
  await expect(coordinates(page)).toHaveText('X 37 / Y 35');
});

test('refuse de construire hors du terrain puis achète la parcelle voisine pour s’y installer', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Limite de l’atelier');
  await page.getByRole('button', { name: /^Réception/ }).click();
  const box = await canvas(page).boundingBox();
  if (!box) throw new Error('La grille est invisible.');
  const right = box.x + box.width;
  const y = box.y + box.height / 2 + 16;

  await page.mouse.move(right - 28, y);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(box.x + 28, y, { steps: 8 });
  await page.mouse.up({ button: 'right' });
  // The camera moved by the drag length: the last owned column is now that far to the left.
  const lastColumn = box.x + box.width / 2 + (63.5 - 32) * 32 - (box.width - 56);
  await page.mouse.move(lastColumn, y);
  await expect(coordinates(page)).toHaveText('X 64 / Y 33');
  const notOwned = 'Ce terrain n’est pas encore à vous : achetez la parcelle.';
  await expect(inspector(page).getByText(notOwned)).toBeVisible();
  await page.mouse.click(lastColumn, y);
  await expect(inspector(page).getByRole('status')).toHaveText(notOwned);
  await expect(equipment(page)).toHaveText('0');
  await expect(capital(page)).toHaveText(euros(25_000));

  await page.keyboard.press('Escape');
  await page.mouse.click(lastColumn + 64, y);
  await expect(inspector(page).getByRole('heading', { name: 'Parcelle 7' })).toBeVisible();
  await inspector(page).getByRole('button', { name: `Acheter la parcelle · ${euros(10_000)}` }).click();
  await expect(page.getByText(`Parcelle achetée pour ${euros(10_000)}.`)).toBeVisible();
  await expect(capital(page)).toHaveText(euros(15_000));
  await expect(page.getByText('5 parcelles possédées')).toBeVisible();
  await page.getByRole('button', { name: /^Réception/ }).click();
  await page.mouse.click(lastColumn, y);
  await expect(equipment(page)).toHaveText('1');
  await expect(capital(page)).toHaveText(euros(15_000 - 4_200));
});

test('refuse une construction quand le capital est insuffisant', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Budget construction');
  await page.getByRole('button', { name: /^Réception/ }).click();

  for (const x of [24, 28, 32, 36, 40]) await clickTile(page, x, 28);
  await expect(equipment(page)).toHaveText('5');
  await expect(capital(page)).toHaveText(euros(4_000));
  await clickTile(page, 30, 32);
  await expect(inspector(page).getByRole('status')).toHaveText('Capital insuffisant pour cette construction.');
  await expect(equipment(page)).toHaveText('5');
  await expect(capital(page)).toHaveText(euros(4_000));
});

test('confirme la démolition et rembourse la moitié du prix payé', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Démolition');
  await page.getByRole('button', { name: /^Stockage/ }).click();
  await clickTile(page, 32, 32);
  await expect(capital(page)).toHaveText(euros(24_400));
  await page.getByRole('button', { name: /^Démolir/ }).click();
  await clickTile(page, 32, 32);
  const dialog = page.getByRole('dialog', { name: /Démolir cet équipement/ });
  await expect(dialog).toContainText(euros(300));
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(equipment(page)).toHaveText('1');
  await expect(capital(page)).toHaveText(euros(24_400));

  await clickTile(page, 32, 32);
  await dialog.getByRole('button', { name: 'Confirmer la démolition' }).click();
  await expect(equipment(page)).toHaveText('0');
  await expect(capital(page)).toHaveText(euros(24_700));
});

test('restaure après rechargement et conserve les sauvegardes d’ateliers distincts', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier des Pins');
  await page.getByRole('button', { name: /^Banc de test/ }).click();
  await page.keyboard.press('r');
  await clickTile(page, 32, 32);
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();

  await page.reload();
  const resumeFirst = page.getByRole('button', { name: 'Reprendre Atelier des Pins' });
  await resumeFirst.click();
  await expect(capital(page)).toHaveText(euros(22_600));
  await expect(canvas(page)).toBeVisible();
  await clickTile(page, 32, 33);
  await expect(inspector(page).getByRole('heading', { name: 'Banc de test' })).toBeVisible();
  await expect(orientation(page)).toHaveText('Est');
  await expect(inspector(page).getByText('33, 33')).toBeVisible();

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await startWorkshop(page, 'Atelier du Port');
  await expect(equipment(page)).toHaveText('0');
  await expect(capital(page)).toHaveText(euros(25_000));
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer et quitter' }).click();
  const resumeSecond = page.getByRole('button', { name: 'Reprendre Atelier du Port' });
  await expect(resumeSecond).toBeVisible();
  await expect(resumeFirst).toBeVisible();

  await page.getByRole('button', { name: 'Supprimer la sauvegarde « Atelier du Port »' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(resumeSecond).toHaveCount(0);
  await page.reload();
  await expect(resumeFirst).toBeVisible();
  await expect(resumeSecond).toHaveCount(0);
});

test('suit le guide et transfère une sauvegarde JSON entre profils', async ({ browser, page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier portable');
  await page.keyboard.press('p');
  const openGuide = page.getByRole('button', { name: 'Guide d’atelier' });
  const guide = page.getByRole('dialog', { name: 'Guide d’atelier' });
  const currentStep = guide.locator('[aria-current="step"]');
  await openGuide.click();
  await expect(currentStep).toContainText('Construire un quai de réception');
  await guide.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 32, 32);
  await openGuide.click();
  await expect(currentStep).toContainText('Commander des pièces');
  await guide.getByRole('button', { name: 'Fermer' }).click();
  await page.keyboard.press('Escape');
  await clickTile(page, 32, 32);
  await inspector(page).getByLabel('Composant').selectOption('ram-16g');
  await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  await openGuide.click();
  await expect(currentStep).toContainText('Lancer l’emballage');
  await guide.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();

  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exporter en JSON · Atelier portable' }).click(),
  ]);
  const file = { name: download.suggestedFilename(), mimeType: 'application/json', buffer: await readFile(await download.path()) };
  expect(file.name).toMatch(/^silicon-empire-[a-f0-9]{8}\.json$/);

  await page.getByLabel('Fichier de sauvegarde').setInputFiles(file);
  await expect(page.getByRole('status')).toContainText('Copie importée.');
  await page.getByLabel('Fichier de sauvegarde').setInputFiles({ ...file, buffer: Buffer.from('{') });
  await expect(page.getByRole('alert')).toContainText('Sauvegarde invalide ou incompatible.');
  await expect(page.getByRole('button', { name: 'Reprendre Atelier portable', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reprendre Atelier portable (copie)', exact: true })).toBeVisible();

  const otherProfile = await browser.newContext({ locale: 'fr-FR' });
  try {
    const other = await otherProfile.newPage();
    await other.goto(page.url());
    await expect(other.getByText('Aucun atelier enregistré')).toBeVisible();
    const [chooser] = await Promise.all([
      other.waitForEvent('filechooser'),
      other.getByRole('button', { name: 'Importer une sauvegarde' }).click(),
    ]);
    await chooser.setFiles(file);
    await expect(other.getByRole('status')).toContainText('Copie importée.');
    await other.reload();
    await other.getByRole('button', { name: 'Reprendre Atelier portable (copie)' }).click();
    await expect(canvas(other)).toBeVisible();
    await expect(capital(other)).toHaveText(euros(25_000 - 4_200 - 400));
    await clickTile(other, 32, 32);
    const memory = inspector(other).getByRole('list', { name: 'Contenu du stock' })
      .getByRole('listitem').filter({ hasText: 'Barrette 16 Go' });
    await expect(memory.getByText('10', { exact: true })).toBeVisible();
    await other.getByRole('button', { name: 'Guide d’atelier' }).click();
    await expect(other.getByRole('dialog').locator('[aria-current="step"]')).toContainText('Lancer l’emballage');
  } finally {
    await otherProfile.close();
  }
});

test('reste dans l’atelier si IndexedDB annule la transaction d’écriture', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = put.call(this, value, key);
      this.transaction.abort();
      return request;
    };
  });
  await page.goto('/');
  await startWorkshop(page, 'Atelier temporaire');
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Revenir au menu/ });
  await dialog.getByRole('button', { name: 'Enregistrer et quitter' }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/Impossible d’enregistrer/);
  await dialog.getByRole('button', { name: 'Annuler' }).click();
  await expect(canvas(page)).toBeVisible();
  await expect(page.getByText(/Impossible d’enregistrer/)).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await dialog.getByRole('button', { name: 'Quitter sans sauvegarder' }).click();
  await expect(page.getByText('Aucun atelier enregistré')).toBeVisible();
});

test('achemine un lot du quai au casier et restaure les unités en transit', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const speed = (label: string) => page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: label });
  const stock = () => inspector(page).getByLabel('Stock', { exact: true });
  const time = () => page.getByLabel('Temps simulé', { exact: true });
  await page.goto('/');
  await startWorkshop(page, 'Atelier logistique');
  await page.keyboard.press('p');
  await expect(speed('Pause')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 30, 34);
  await page.getByRole('button', { name: /^Convoyeur/ }).click();
  await clickTile(page, 31, 33);
  await clickTile(page, 31, 32);
  await page.getByRole('button', { name: /^Stockage/ }).click();
  await clickTile(page, 31, 31);
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 80 - 600));

  await page.keyboard.press('Escape');
  await clickTile(page, 31, 35);
  await expect(inspector(page).getByText('Nord · raccordée')).toBeVisible();
  await inspector(page).getByLabel('Composant').selectOption('ram-16g');
  await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 80 - 600 - 400));
  await expect(stock()).toHaveText('10 / 100');
  await expect(time()).toHaveText('0:00:00');

  await clickTile(page, 31, 31);
  await expect(inspector(page).getByText('Sud · raccordée')).toBeVisible();
  await speed('×5').click();
  await expect(stock()).toHaveText('10 / 40', { timeout: 10_000 });
  await expect(inspector(page).getByRole('list', { name: 'Contenu du stock' })).toContainText('Barrette 16 Go');

  await clickTile(page, 31, 35);
  await expect(inspector(page).getByLabel('Composant')).toHaveValue('cpu-8c');
  await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  await speed('×1').click();
  await clickTile(page, 31, 31);
  await expect(stock()).toHaveText(/^1[1-9] \/ 40$/, { timeout: 10_000 });
  await page.keyboard.press('p');
  // Panels refresh in groups while time passes; wait for the last refresh after the pause.
  await expect.poll(async () => {
    const before = await time().textContent();
    await page.waitForTimeout(300);
    return before === await time().textContent();
  }).toBe(true);
  const pausedAt = await time().textContent();
  const storedThen = await stock().textContent();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'Reprendre Atelier logistique' }).click();
  await expect(speed('Pause')).toHaveAttribute('aria-pressed', 'true');
  await expect(time()).toHaveText(pausedAt ?? '');
  await clickTile(page, 31, 31);
  await expect(stock()).toHaveText(storedThen ?? '');
  await speed('×5').click();
  await expect(stock()).toHaveText('20 / 40', { timeout: 10_000 });
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 80 - 600 - 400 - 1_800));
  expect(pageErrors).toEqual([]);
});

test('trace une ligne de convoyeurs au glisser et trie les composants avec un répartiteur filtré', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  const stock = () => inspector(page).getByLabel('Stock', { exact: true });
  await page.goto('/');
  await startWorkshop(page, 'Atelier de tri');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 26, 36);
  await page.getByRole('button', { name: /^Convoyeur/ }).click();
  const start = await tileAtCenterZoom(page, 27, 35);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of [[27, 32], [30, 32]] as const) {
    const point = await tileAtCenterZoom(page, x, y);
    await page.mouse.move(point.x, point.y, { steps: 8 });
  }
  await expect(inspector(page).getByLabel('Coût du tracé')).toHaveText(euros(280));
  await expect(inspector(page).getByText('7 tuiles')).toBeVisible();
  await page.mouse.up();
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 280));
  await expect(equipment(page)).toHaveText('8');

  await page.getByRole('button', { name: /^Répartiteur/ }).click();
  await page.keyboard.press('r');
  await clickTile(page, 31, 32);
  await page.getByRole('button', { name: /^Stockage/ }).click();
  await clickTile(page, 31, 31);
  await page.keyboard.press('r');
  await clickTile(page, 32, 32);
  await page.keyboard.press('r');
  await clickTile(page, 31, 33);
  await expect(equipment(page)).toHaveText('12');

  await page.keyboard.press('Escape');
  await clickTile(page, 31, 32);
  await expect(inspector(page).getByRole('heading', { name: 'Répartiteur' })).toBeVisible();
  await inspector(page).getByLabel('Composant filtré').selectOption('gpu-8g');
  await inspector(page).getByLabel('Sortie du filtre').selectOption('right');
  await expect(inspector(page).getByText('Sortie droite')).toBeVisible();

  await clickTile(page, 27, 37);
  await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  await inspector(page).getByLabel('Composant').selectOption('gpu-8g');
  await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×5' }).click();

  await clickTile(page, 31, 33);
  await expect(stock()).toHaveText('10 / 40', { timeout: 20_000 });
  await expect(inspector(page).getByRole('list', { name: 'Contenu du stock' })).toHaveText(/Carte graphique 8 Go V8\s*10/);
  for (const [x, y] of [[31, 31], [32, 32]] as const) {
    await clickTile(page, x, y);
    await expect(stock()).toHaveText('5 / 40', { timeout: 10_000 });
    await expect(inspector(page).getByRole('list', { name: 'Contenu du stock' })).toContainText('Processeur 8 cœurs K8');
  }
  expect(pageErrors).toEqual([]);
});

test('change de langue depuis le menu, traduit l’atelier et garde ce choix', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Langue').selectOption('en');
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
  await page.reload();
  await expect(page.getByRole('button', { name: 'New game' })).toBeVisible();

  await page.getByLabel('Workshop name').fill('Tokyo');
  await page.getByRole('radio', { name: /^Classic/ }).check();
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page.getByRole('region', { name: 'Interactive workshop grid' })).toBeVisible();
  await expect(page.getByLabel('Available capital', { exact: true })).toHaveText('$28,000');
  await page.getByRole('button', { name: /^Storage/ }).click();
  const point = await (async () => {
    const box = await page.getByRole('region', { name: 'Interactive workshop grid' }).boundingBox();
    if (!box) throw new Error('Grid hidden');
    return { x: box.x + box.width / 2 + 16, y: box.y + box.height / 2 + 16 };
  })();
  await page.mouse.click(point.x, point.y);
  await expect(page.getByRole('complementary', { name: 'Inspection' }).getByRole('status')).toHaveText('Storage locker built.');

  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByRole('dialog', { name: /Back to the menu/ }).getByRole('button', { name: 'Leave without saving' }).click();
  await page.getByLabel('Language').selectOption('ja');
  await expect(page.getByRole('button', { name: 'ニューゲーム' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ja-JP');
  expect(pageErrors).toEqual([]);
});

test.describe('langue du navigateur', () => {
  test.use({ locale: 'de-DE' });

  test('suit la langue du navigateur au premier lancement', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Neues Spiel' })).toBeVisible();
    await expect(page.getByLabel('Sprache')).toHaveValue('de');
    await expect(page.getByText('Startkapital')).toBeVisible();
  });
});

test('valide le premier jalon à la Direction, débloque l’établi et le garde après reprise', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await startWorkshop(page, 'Atelier progressif', { progression: true });
  await expect(page.getByRole('button', { name: /^Assemblage/ })).toHaveCount(0);
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: /^Direction/ }).click();
  await clickTile(page, 30, 30);
  await expect(inspector(page).getByRole('heading', { name: 'Direction' })).toBeVisible();
  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 28, 36);
  await page.getByRole('button', { name: /^Convoyeur/ }).click();
  const start = await tileAtCenterZoom(page, 29, 35);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  for (const [x, y] of [[29, 33], [30, 33], [30, 32]] as const) {
    const point = await tileAtCenterZoom(page, x, y);
    await page.mouse.move(point.x, point.y, { steps: 6 });
  }
  await page.mouse.up();
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 200));

  await page.getByRole('button', { name: /^Progression/ }).click();
  const panel = page.getByRole('dialog', { name: 'Progression' });
  const campus = panel.getByRole('listitem', { name: /Contrat phare/ });
  await expect(campus).toContainText('50');
  await expect(campus).toContainText('Convoyeurs rapides, Subvention régionale');
  await expect(campus.getByRole('button')).toHaveCount(0);
  await panel.getByRole('listitem', { name: 'Poste de montage' }).getByRole('button', { name: 'Définir comme objectif' }).click();
  await expect(panel.getByRole('listitem', { name: 'Poste de montage' })).toContainText('Objectif en cours');
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('button', { name: /^Progression/ })).toContainText('Poste de montage');

  await page.keyboard.press('Escape');
  await clickTile(page, 29, 37);
  for (const item of ['psu-650', 'case-standard']) {
    await inspector(page).getByLabel('Composant').selectOption(item);
    await inspector(page).getByRole('button', { name: /^Commander 10 unités/ }).click();
  }
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 200 - 1_000));
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×5' }).click();

  await expect(page.getByRole('button', { name: /^Assemblage/ })).toBeVisible({ timeout: 20_000 });
  await expect(capital(page)).toHaveText(euros(25_000 - 4_200 - 200 - 1_000 + 1_500));
  await expect(page.getByRole('button', { name: /^Progression/ })).toContainText('Aucun objectif choisi.');

  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre Atelier progressif' }).click();
  await expect(page.getByRole('button', { name: /^Assemblage/ })).toBeVisible();
  await page.getByRole('button', { name: /^Progression/ }).click();
  await expect(page.getByRole('dialog', { name: 'Progression' }).getByRole('listitem', { name: 'Poste de montage' })).toContainText('Terminé');
  await expect(page.getByRole('dialog', { name: 'Progression' }).getByRole('listitem', { name: 'Contrôle qualité' })).toContainText('Disponible');
  expect(pageErrors).toEqual([]);
});

test('choisit la gamme gaming sur les trois machines et garde les modèles après reprise', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Valmont');
  const recipes = [
    { tool: /^Assemblage/, x: 29, name: 'PC gaming assemblé', input: /Carte graphique 8 Go V8/ },
    { tool: /^Banc de test/, x: 32, name: 'PC gaming testé', input: /PC gaming assemblé/ },
    { tool: /^Emballeuse/, x: 35, name: 'PC gaming emballé', input: /PC gaming testé/ },
  ];
  const model = inspector(page).getByLabel('Modèle de PC');
  const ingredients = inspector(page).getByRole('list', { name: 'Recette' });
  for (const station of recipes) {
    await page.getByRole('button', { name: station.tool }).click();
    await clickTile(page, station.x, 32);
    await page.keyboard.press('Escape');
    await clickTile(page, station.x, 32);
    await expect(model).toHaveValue('office');
    await model.selectOption('gaming');
    await expect(inspector(page)).toContainText(station.name);
    await expect(ingredients).toContainText(station.input);
  }
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre Atelier Valmont' }).click();
  await expect(canvas(page)).toBeVisible();
  for (const station of recipes) {
    await clickTile(page, station.x, 32);
    await expect(model).toHaveValue('gaming');
    await expect(ingredients).toContainText(station.input);
  }
  await clickTile(page, 32, 32);
  await expect(inspector(page).getByText('Sortie des rebuts')).toHaveCount(0);
  await model.selectOption('professional');
  await expect(inspector(page)).toContainText('Est · Non raccordée');
  await expect(inspector(page)).toContainText('Un PC sur 8 est écarté au contrôle.');
  await page.keyboard.press('r');
  await expect(inspector(page)).toContainText('Sud · Non raccordée');
});

test('livre le dernier PC du contrat de Valmont, crédite la récompense et débloque la gamme', async ({ page }) => {
  // Atelier sauvegardé avant sa dernière livraison. Les stocks et le registre reflètent les jalons déjà réglés.
  const saved = {
    version: 5,
    id: '56414c4d4f4e54000000000000000001',
    name: 'Contrat Valmont',
    createdAt: 1000,
    savedAt: 2000,
    world: {
      columns: 64, rows: 64, tick: 290_000, capitalCents: 1_500_000, nextMachineId: 4, nextItemId: 802,
      machines: [
        { id: 1, type: 'headquarters', x: 28, y: 30, rotation: 0, paidCents: 0 },
        { id: 2, type: 'conveyor', x: 28, y: 32, rotation: 0, paidCents: 4_000 },
        { id: 3, type: 'assembler', x: 32, y: 31, rotation: 0, paidCents: 180_000 },
      ],
      stocks: {},
      belts: { 2: [{ id: 801, item: 'pc-office-packaged', position: 19 }] },
      routers: {},
      production: {},
      progress: {
        sandbox: false,
        completed: ['assembly-bench', 'quality-control', 'flow-control', 'packaging', 'fast-belts', 'regional-grant'],
        active: null,
        delivered: { 'campus-contract': { 'pc-office-packaged': 49 } },
      },
      ledger: {
        purchaseSpentCents: 6_710_000,
        purchased: { 'cpu-8c': 140, 'ram-16g': 140, 'ssd-1t': 140, 'motherboard-atx': 140, 'psu-650': 150, 'case-standard': 150, carton: 100 },
        discarded: { 'cpu-8c': 5, 'ram-16g': 5, 'ssd-1t': 5, 'motherboard-atx': 5, 'psu-650': 5, 'case-standard': 5 },
        produced: { 'pc-office': 135, 'pc-office-tested': 130, 'pc-office-packaged': 100 },
        consumed: { 'cpu-8c': 135, 'ram-16g': 135, 'ssd-1t': 135, 'motherboard-atx': 135, 'psu-650': 135, 'case-standard': 135, carton: 100, 'pc-office': 130, 'pc-office-tested': 100 },
        delivered: { 'case-standard': 10, 'psu-650': 10, 'pc-office': 5, 'pc-office-tested': 30, 'pc-office-packaged': 99 },
      },
    },
  };
  await resumeFixture(page, saved);
  await clickTile(page, 32, 31);
  const model = inspector(page).getByLabel('Modèle de PC');
  await expect(model).toHaveCount(0);
  await expect(capital(page)).toHaveText(euros(15_000));

  await page.getByRole('button', { name: /^Progression/ }).click();
  const panel = page.getByRole('dialog', { name: 'Progression' });
  const contract = panel.getByRole('listitem', { name: /Contrat phare/ });
  await expect(contract).toContainText('49 / 50');
  await contract.getByRole('button', { name: 'Définir comme objectif' }).click();
  await panel.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×1' }).click();
  await expect(capital(page)).toHaveText(euros(53_000));
  await model.selectOption('gaming');
  await expect(inspector(page).getByRole('list', { name: 'Recette' })).toContainText('Carte graphique');
  await page.getByRole('button', { name: /^Progression/ }).click();
  await expect(contract).toContainText('Terminé');
  await expect(panel.getByRole('listitem', { name: 'Tournoi de Valmont' })).toContainText('Disponible');
  await expect(panel.getByRole('listitem', { name: /Institut Sorel/ })).toContainText('Verrouillé');
});

test('reprend un contrôle professionnel et stocke séparément le PC conforme et le rebut', async ({ page }) => {
  const saved = {
    version: 6,
    id: '534f52454c0000000000000000000001',
    name: 'Atelier Sorel',
    createdAt: 1000,
    savedAt: 2000,
    world: {
      columns: 64, rows: 64, tick: 7050, capitalCents: 1_000_000, nextMachineId: 6, nextItemId: 24,
      machines: [
        { id: 1, type: 'tester', x: 31, y: 32, rotation: 0, paidCents: 240000, model: 'professional' },
        { id: 2, type: 'conveyor', x: 32, y: 31, rotation: 0, paidCents: 4000 },
        { id: 3, type: 'storage', x: 32, y: 30, rotation: 0, paidCents: 60000 },
        { id: 4, type: 'conveyor', x: 33, y: 32, rotation: 1, paidCents: 4000 },
        { id: 5, type: 'storage', x: 34, y: 32, rotation: 1, paidCents: 60000 },
      ],
      stocks: {},
      belts: {},
      routers: {},
      production: {
        1: {
          batch: { item: 'pc-professional-rejected', remaining: 1 },
          output: { 'pc-professional-tested': 1 },
        },
      },
      progress: { sandbox: true, completed: [], active: null, delivered: {} },
      ledger: {
        purchased: {}, purchaseSpentCents: 0,
        produced: { 'pc-professional': 8, 'pc-professional-tested': 7, 'pc-professional-rejected': 1 },
        consumed: { 'pc-professional': 8 },
        discarded: { 'pc-professional-tested': 6 },
        delivered: {},
      },
    },
  };
  await resumeFixture(page, saved);
  await clickTile(page, 31, 32);
  await expect(inspector(page).getByLabel('Modèle de PC')).toHaveValue('professional');
  await expect(inspector(page)).toContainText('Est · raccordée');
  await expect(inspector(page)).toContainText('PC professionnel conforme · 1 / 2');
  const clock = page.getByRole('group', { name: 'Vitesse de simulation' });
  await clock.getByRole('button', { name: '×5' }).click();

  const stock = inspector(page).getByRole('list', { name: 'Contenu du stock' });
  await clickTile(page, 32, 30);
  await expect(stock.getByRole('listitem')).toHaveCount(1);
  await expect(stock).toContainText('PC professionnel conforme');
  await clickTile(page, 34, 32);
  await expect(stock.getByRole('listitem')).toHaveCount(1);
  await expect(stock).toContainText('PC professionnel non conforme');
});

test('accepte une commande au quai et affiche le paiement de la dernière livraison', async ({ page }) => {
  await resumeFixture(page, {
    version: 7,
    id: '56454e54450000000000000000000001',
    name: 'Atelier commercial',
    createdAt: 1000,
    savedAt: 2000,
    world: {
      columns: 64, rows: 64, tick: 1000, capitalCents: 1_000_000, nextMachineId: 3, nextItemId: 12,
      machines: [
        { id: 1, type: 'shipping', x: 32, y: 30, rotation: 0, paidCents: 160_000 },
        { id: 2, type: 'conveyor', x: 32, y: 32, rotation: 0, paidCents: 4000 },
      ],
      stocks: {}, routers: {}, production: {},
      belts: { 2: [{ id: 11, item: 'pc-office-packaged', position: 19 }] },
      progress: { sandbox: true, completed: [], active: null, delivered: {} },
      sales: {
        active: {
          delivered: 9,
          terms: { model: 'office', revision: 1, item: 'pc-office-packaged', units: 10, unitPriceCents: 65000, unitMaterialCents: 47300 },
        },
        completed: [],
      },
      ledger: {
        purchased: {}, discarded: {}, purchaseSpentCents: 0,
        produced: { 'pc-office-packaged': 10 }, consumed: {}, delivered: {},
      },
    },
  });
  await clickTile(page, 32, 30);
  await expect(inspector(page)).toContainText('9 / 10');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×1' }).click();
  await expect(capital(page)).toHaveText(euros(16_500));
  await page.getByRole('button', { name: 'Ventes', exact: true }).first().click();
  const sales = page.getByRole('dialog', { name: 'Ventes' });
  await expect(sales.getByLabel('Recettes des ventes')).toHaveText(euros(6500));
  await sales.getByRole('listitem', { name: 'PC bureautique emballé' }).getByRole('button', { name: 'Accepter la commande' }).click();
  await expect(sales).toContainText('0 / 10');
  await expect(capital(page)).toHaveText(euros(16_500));
});

test('valide un modèle sur mesure et garde une commande fournisseur réservée', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Nacre');
  await page.getByRole('button', { name: 'Conception de PC' }).click();
  const designer = page.getByRole('dialog', { name: 'Conception de PC' });
  await designer.getByLabel('Nom du modèle').fill('Nacre');
  await designer.getByLabel('Carte graphique').selectOption('gpu-8g');
  await expect(designer.getByRole('alert')).toContainText('puissance requise');
  const publish = designer.getByRole('button', { name: 'Valider le modèle' });
  await expect(publish).toBeDisabled();
  await designer.getByLabel('Alimentation', { exact: true }).selectOption('psu-650');
  await publish.click();
  await expect(designer.getByRole('status')).toHaveText('Révision active 1 · Nacre');
  await designer.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: /^Assemblage/ }).click();
  await clickTile(page, 31, 32);
  await page.keyboard.press('Escape');
  await clickTile(page, 31, 32);
  await inspector(page).getByLabel('Modèle de PC').selectOption('custom');
  await expect(inspector(page).getByRole('list', { name: 'Recette' })).toContainText('Carte graphique 8 Go');

  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 35, 34);
  await page.keyboard.press('Escape');
  await clickTile(page, 35, 34);
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await inspector(page).getByLabel('Composant').selectOption('ram-16g');
  await inspector(page).getByLabel('Fournisseur').selectOption('economy');
  const order = inspector(page).getByRole('button', { name: /^Commander 10 unités/ });
  await expect(order).toContainText(euros(340));
  await order.click();
  const pending = inspector(page).getByRole('list', { name: 'Livraisons attendues' });
  await expect(pending).toContainText('10 × Barrette 16 Go');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre Atelier Nacre' }).click();
  await expect(canvas(page)).toBeVisible();
  await clickTile(page, 35, 34);
  await expect(pending).toContainText('10 × Barrette 16 Go');
  await clickTile(page, 31, 32);
  await expect(inspector(page).getByLabel('Modèle de PC')).toHaveValue('custom');
});

test('améliore un établi en Mk2 et garde le projet de recherche choisi après reprise', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Orme');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /^Assemblage/ }).click();
  await clickTile(page, 31, 32);
  await page.keyboard.press('Escape');
  await clickTile(page, 31, 32);
  const before = await capital(page).innerText();
  const upgrade = inspector(page).getByRole('button', { name: /^Améliorer en Mk2/ });
  await expect(upgrade).toContainText(euros(3000));
  await upgrade.click();
  await expect(page.getByText('Machine améliorée en Mk2.')).toBeVisible();
  await expect(upgrade).toHaveCount(0);
  await expect(inspector(page).locator('.machine-stats > div', { has: page.getByText('Niveau', { exact: true }) })).toContainText('Mk2');
  await expect(capital(page)).not.toHaveText(before);

  await page.getByRole('button', { name: /^Laboratoire/ }).click();
  await clickTile(page, 36, 32);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Recherche', exact: true }).click();
  const research = page.getByRole('dialog', { name: 'Recherche' });
  await expect(research.getByText('Construisez un laboratoire')).toHaveCount(0);
  const dock = research.getByRole('listitem', { name: 'Quai agrandi' });
  await dock.getByRole('button', { name: 'Lancer ce projet' }).click();
  await expect(dock).toContainText('Projet en cours');
  await expect(dock).toContainText('0 / 30');
  await research.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Atelier enregistré', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre Atelier Orme' }).click();
  await expect(canvas(page)).toBeVisible();
  await clickTile(page, 36, 32);
  await expect(inspector(page)).toContainText('Quai agrandi');
  await clickTile(page, 31, 32);
  await expect(inspector(page).locator('.machine-stats > div', { has: page.getByText('Niveau', { exact: true }) })).toContainText('Mk2');
});

test('affiche les montants dans la devise choisie au menu et garde ce choix', async ({ page }) => {
  await page.goto('/');
  const currency = page.getByLabel('Devise');
  await expect(currency).toHaveValue('auto');
  await expect(currency.locator('option[value="auto"]')).toHaveText('Automatique (euro)');
  await currency.selectOption('USD');
  await startWorkshop(page, 'Atelier Brume');
  await expect(capital(page)).toHaveText(/^28\s000\s\$US$/);
  await page.reload();
  await expect(page.getByLabel('Devise')).toHaveValue('USD');
  await page.getByLabel('Langue').selectOption('ja');
  const yen = page.getByLabel('通貨');
  await yen.selectOption('auto');
  await expect(yen.locator('option[value="auto"]')).toHaveText('自動（日本円）');
  await page.reload();
  await expect(page.getByLabel('通貨')).toHaveValue('auto');
});

test('remplit le panier de la boutique avec remise de volume et livre le quai en une commande', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Lisière');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 35, 34);
  await page.keyboard.press('Escape');
  const before = await capital(page).innerText();

  await page.getByRole('button', { name: 'Boutique', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Boutique de composants' });
  await expect(shop.getByLabel('Quai de livraison')).toContainText('100 places libres');
  const cpu = shop.getByRole('listitem', { name: 'Processeur 8 cœurs K8' }).first();
  for (let lot = 0; lot < 5; lot++) await cpu.getByRole('button', { name: 'Ajouter un lot' }).click();
  await shop.getByRole('listitem', { name: 'Barrette 16 Go' }).first().getByRole('button', { name: 'Ajouter un lot' }).click();
  const cart = shop.getByRole('region', { name: 'Panier' });
  await expect(cart.getByRole('listitem', { name: 'Processeur 8 cœurs K8' })).toContainText('5 lots');
  await expect(cart.getByRole('listitem', { name: 'Processeur 8 cœurs K8' })).toContainText('−5');
  await expect(cart).toContainText('60 unités pour 100 places libres');
  // 5 lots of CPUs at 1 800 € with 5 % off, plus one lot of memory at 400 €.
  const checkout = cart.getByRole('button', { name: /^Commander/ });
  await expect(checkout).toContainText(euros(8950));
  await checkout.click();
  await expect(page.getByText(`Commande passée\u2009: 6 lots pour ${euros(8950)}.`)).toBeVisible();
  await expect(cart).toContainText('Le panier est vide.');
  await shop.getByRole('button', { name: 'Fermer' }).click();

  await expect(capital(page)).not.toHaveText(before);
  await clickTile(page, 35, 34);
  const stock = inspector(page).getByRole('list', { name: 'Contenu du stock' });
  await expect(stock).toContainText('Processeur 8 cœurs K8');
  await expect(stock).toContainText('50');
  await expect(stock).toContainText('Barrette 16 Go');
});

test('embauche un candidat, l’affecte à l’établi depuis l’inspecteur puis le licencie', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Saule');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /^Assemblage/ }).click();
  await clickTile(page, 31, 32);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Personnel', exact: true }).click();
  const staff = page.getByRole('dialog', { name: 'Personnel' });
  await expect(staff.getByText('Aucun employé.')).toBeVisible();
  const candidates = staff.getByRole('region', { name: 'Candidats' });
  await expect(candidates.getByRole('listitem')).toHaveCount(5);
  const first = candidates.getByRole('listitem').first();
  const name = await first.getAttribute('aria-label');
  if (!name) throw new Error('Candidat sans nom.');
  await first.getByRole('button', { name: /^Embaucher/ }).click();
  await expect(page.getByText(`${name} rejoint l’atelier.`)).toBeVisible();
  await expect(candidates.getByRole('listitem')).toHaveCount(4);
  const employee = staff.getByRole('region', { name: 'Employés' }).getByRole('listitem', { name });
  await expect(employee.getByLabel('Poste')).toHaveValue('');
  await staff.getByRole('button', { name: 'Fermer' }).click();

  await clickTile(page, 31, 32);
  const operator = inspector(page).getByLabel('Opérateur');
  const option = await operator.locator('option', { hasText: name }).getAttribute('value');
  if (!option) throw new Error('Employé absent de la liste des opérateurs.');
  await operator.selectOption(option);
  await expect(operator).not.toHaveValue('');

  await page.getByRole('button', { name: 'Personnel', exact: true }).click();
  await expect(employee.getByLabel('Poste')).toHaveValue('1');
  const before = await capital(page).innerText();
  await employee.getByRole('button', { name: /^Licencier/ }).click();
  await expect(page.getByText(`${name} quitte l’atelier.`)).toBeVisible();
  await expect(staff.getByText('Aucun employé.')).toBeVisible();
  await expect(capital(page)).not.toHaveText(before);
});

test('trace des murs au glisser, ferme une salle de repos et pose un parquet', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Tilleul');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: /^Mur/ }).click();
  const path: [number, number][] = [[30, 28], [33, 28], [33, 32], [28, 32], [28, 28]];
  const [start, ...rest] = path;
  if (!start) throw new Error('Tracé vide.');
  const first = await tileAtCenterZoom(page, start[0], start[1]);
  await page.mouse.move(first.x, first.y);
  await page.mouse.down();
  for (const [x, y] of rest) {
    const point = await tileAtCenterZoom(page, x, y);
    await page.mouse.move(point.x, point.y, { steps: 6 });
  }
  await page.mouse.up();
  await expect(page.getByText(`17 murs construits pour ${euros(340)}.`)).toBeVisible();

  await page.getByRole('button', { name: /^Porte/ }).click();
  await clickTile(page, 29, 28);
  await page.getByRole('button', { name: /^Canapé/ }).click();
  await clickTile(page, 29, 29);
  await page.getByRole('button', { name: /^Café/ }).click();
  await clickTile(page, 32, 31);
  await page.getByRole('button', { name: /^Parquet/ }).click();
  await clickTile(page, 31, 30);
  await expect(page.getByText(`Parquet posé pour ${euros(15)}.`)).toBeVisible();
  await page.keyboard.press('Escape');

  await clickTile(page, 29, 29);
  await expect(inspector(page)).toContainText('Salle de repos');
  await expect(inspector(page)).toContainText('12 tuiles');
  await expect(inspector(page)).toContainText('4 places assises');
  await page.getByRole('button', { name: 'Personnel', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Personnel' })).toContainText('Salles de repos : 4 places pour 0 employé');
});

test('démarre une carrière : spécialité, prêt, première chaîne guidée par le tutoriel et vente au grossiste', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /^Carrière/ })).toBeChecked();
  await startWorkshop(page, 'Atelier Ardoise', { career: true });
  await expect(capital(page)).toHaveText(euros(0));
  const tutorial = page.getByRole('complementary', { name: 'Tutoriel' });
  await expect(tutorial).toContainText('Étape 1 sur 10');

  const starter = page.getByRole('dialog', { name: 'Choisissez votre spécialité' });
  await starter.getByRole('listitem', { name: 'Composants passifs' }).getByRole('button', { name: 'Démarrer avec cette spécialité' }).click();
  await expect(starter).toHaveCount(0);
  await expect(tutorial).toContainText('Étape 2 sur 10');
  await expect(page.getByRole('button', { name: 'Banque', exact: true })).toHaveClass(/tutorial-target/);

  await page.getByRole('button', { name: 'Banque', exact: true }).click();
  const bank = page.getByRole('dialog', { name: 'Banque' });
  await bank.getByRole('listitem', { name: 'Prêt de démarrage' }).getByRole('button', { name: `Emprunter ${euros(20_000)}` }).click();
  await expect(capital(page)).toHaveText(euros(20_000));
  await expect(bank.getByRole('list', { name: 'Prêts en cours' })).toContainText('24 mensualités restantes');
  await bank.getByRole('button', { name: 'Fermer' }).click();
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();

  await expect(page.getByRole('button', { name: /^Réception/ })).toHaveClass(/tutorial-target/);
  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 30, 36);
  await expect(page.getByRole('button', { name: /^Presse/ })).toHaveClass(/tutorial-target/);
  await page.getByRole('button', { name: /^Presse/ }).click();
  await clickTile(page, 31, 33);
  await expect(tutorial).toContainText('Étape 5 sur 10');
  await expect(page.getByRole('button', { name: /^Réseau/ })).toHaveClass(/tutorial-target/);
  await page.getByRole('button', { name: /^Réseau/ }).click();
  await clickTile(page, 28, 33);
  await page.getByRole('button', { name: /^Câble/ }).click();
  await clickTile(page, 30, 33);
  await expect(page.getByText(`1 câble posé pour ${euros(5)}.`)).toBeVisible();
  await expect(tutorial).toContainText('Étape 6 sur 10');
  await page.getByRole('button', { name: /^Convoyeur/ }).click();
  await clickTile(page, 31, 35);
  await expect(tutorial).toContainText('Étape 7 sur 10');
  await clickTile(page, 32, 32);
  await page.getByRole('button', { name: /^Expédition/ }).click();
  await clickTile(page, 32, 30);
  await expect(tutorial).toContainText('Étape 8 sur 10');

  await page.getByRole('button', { name: 'Boutique', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Boutique de composants' });
  const ceramic = shop.getByRole('listitem', { name: 'Poudre céramique' }).first();
  await ceramic.getByRole('button', { name: 'Ajouter un lot' }).click();
  await ceramic.getByRole('button', { name: 'Ajouter un lot' }).click();
  await shop.getByRole('listitem', { name: 'Feuille de cuivre' }).first().getByRole('button', { name: 'Ajouter un lot' }).click();
  await shop.getByRole('region', { name: 'Panier' }).getByRole('button', { name: /^Commander/ }).click();
  await shop.getByRole('button', { name: 'Fermer' }).click();
  await expect(tutorial).toContainText('Étape 9 sur 10');

  const before = 20_000 - 4_200 - 6_000 - 5_000 - 5 - 80 - 1_600 - 700;
  await expect(capital(page)).toHaveText(euros(before));
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×5' }).click();
  await expect(capital(page)).toHaveText(euros(before + 140), { timeout: 20_000 });
  await expect(tutorial).toContainText('Étape 10 sur 10');
  await page.getByRole('button', { name: 'Ventes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Grossiste' })).toContainText('Ventes au grossiste');
});

test('trie la construction par onglets, cherche à la boutique, alimente une machine et l’améliore en Mk3', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Volta');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();
  const tools = page.getByRole('group', { name: 'Outils de construction' });
  await page.getByRole('tab', { name: 'Énergie' }).click();
  await expect(page.getByRole('tab', { name: 'Énergie' })).toHaveAttribute('aria-selected', 'true');
  await expect(tools.getByRole('button', { name: /^Assemblage/ })).toHaveCount(0);
  await expect(tools.getByRole('button', { name: /^Réseau/ })).toBeVisible();
  await expect(tools.getByRole('button', { name: /^Câble/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Tout' }).click();

  await page.getByRole('button', { name: /^Assemblage/ }).click();
  await clickTile(page, 31, 32);
  await page.keyboard.press('Escape');
  await clickTile(page, 31, 32);
  await expect(inspector(page)).toContainText('Aucun câble');
  await expect(inspector(page)).toContainText('Sans électricité');
  await page.getByRole('button', { name: /^Réseau/ }).click();
  await clickTile(page, 34, 32);
  await page.getByRole('button', { name: /^Câble/ }).click();
  await clickTile(page, 33, 32);
  await page.keyboard.press('Escape');
  await clickTile(page, 31, 32);
  await expect(inspector(page)).toContainText('10 / 150 kW');

  await inspector(page).getByRole('button', { name: /^Améliorer en Mk2/ }).click();
  await inspector(page).getByRole('button', { name: /^Améliorer en Mk3/ }).click();
  await expect(page.getByText('Machine améliorée en Mk3.')).toBeVisible();
  await expect(inspector(page)).toContainText('20 / 150 kW');

  await page.getByRole('button', { name: 'Boutique', exact: true }).click();
  const shop = page.getByRole('dialog', { name: 'Boutique de composants' });
  await shop.getByLabel('Rechercher').fill('ceramique');
  await expect(shop.getByRole('list', { name: 'Boutique de composants' }).getByRole('listitem')).toHaveCount(1);
  await expect(shop.getByRole('listitem', { name: 'Poudre céramique' })).toBeVisible();
  await shop.getByLabel('Rechercher').fill('');
  await shop.getByLabel('Trier').selectOption('priceDesc');
  await expect(shop.getByRole('list', { name: 'Boutique de composants' }).getByRole('listitem').first()).toHaveAttribute('aria-label', 'Transformateur');
});

test('personnalise l’entreprise et confie le réassort d’un quai à un magasinier', async ({ page }) => {
  await page.goto('/');
  await startWorkshop(page, 'Atelier Héron');
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: 'Pause' }).click();

  await page.getByRole('button', { name: 'Entreprise', exact: true }).click();
  const company = page.getByRole('dialog', { name: 'Entreprise' });
  await company.getByLabel('Couleur').selectOption('sky');
  await company.getByLabel('Emblème').selectOption('bolt');
  await company.getByRole('button', { name: 'Enregistrer l’identité' }).click();
  await expect(page.getByText('Identité de l’entreprise enregistrée.')).toBeVisible();
  await expect(page.locator('.workshop-brand .brand-mark')).toHaveCSS('background-color', 'rgb(140, 200, 255)');
  await expect(company.getByRole('listitem', { name: 'Magasinier' })).toContainText('0 employé');
  await company.getByRole('button', { name: 'Fermer' }).click();

  await page.getByRole('button', { name: /^Réception/ }).click();
  await clickTile(page, 30, 34);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Personnel', exact: true }).click();
  const staff = page.getByRole('dialog', { name: 'Personnel' });
  const storekeeper = staff.getByRole('region', { name: 'Candidats' }).getByRole('listitem').filter({ hasText: 'Magasinier' }).first();
  await expect(storekeeper).toContainText('Tient un quai de réception');
  await storekeeper.getByRole('button', { name: /^Embaucher/ }).click();
  await staff.getByRole('button', { name: 'Fermer' }).click();

  await clickTile(page, 30, 34);
  await inspector(page).getByLabel('Magasinier').selectOption({ index: 1 });
  await inspector(page).getByRole('checkbox', { name: /Processeur 8 cœurs K8/ }).check();
  await expect(page.getByText('Liste de réassort enregistrée.')).toBeVisible();
  const before = await capital(page).innerText();
  await page.getByRole('group', { name: 'Vitesse de simulation' }).getByRole('button', { name: '×1' }).click();
  await expect(capital(page)).not.toHaveText(before, { timeout: 15_000 });
  await expect(inspector(page).getByRole('list', { name: 'Contenu du stock' })).toContainText('Processeur 8 cœurs K8');
});
