import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const capital = (page: Page) => page.getByLabel('Capital disponible', { exact: true });
const equipment = (page: Page) => page.getByLabel('Équipements installés', { exact: true });
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Inspection' });
const canvas = (page: Page) => page.getByRole('region', { name: 'Grille interactive de l’atelier' });
const coordinates = (page: Page) => page.getByLabel('Case survolée');
const euros = (amount: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(amount);

async function startWorkshop(page: Page, name: string) {
  await page.getByLabel('Nom de l’atelier').fill(name);
  await page.getByRole('button', { name: 'Nouvelle partie' }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
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
  await expect(inspector(page).getByText('Est', { exact: true })).toBeVisible();
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
  await expect(inspector(page).getByText('Est', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Pivoter/ }).click();
  await expect(inspector(page).getByText('Sud', { exact: true })).toBeVisible();
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

test('affiche l’emprise invalide et refuse de construire au-delà du bord', async ({ page }) => {
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
  const lastColumn = right - 64 - 16;
  await page.mouse.move(lastColumn, y);
  await expect(coordinates(page)).toHaveText('X 64 / Y 33');
  await expect(inspector(page).getByText('L’emprise dépasse les limites de l’atelier.')).toBeVisible();
  await page.mouse.click(lastColumn, y);
  await expect(inspector(page).getByRole('status')).toHaveText('L’emprise dépasse les limites de l’atelier.');
  await expect(equipment(page)).toHaveText('0');
  await expect(capital(page)).toHaveText(euros(25_000));
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
  await expect(inspector(page).getByText('Est', { exact: true })).toBeVisible();
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
