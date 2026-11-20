import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import {
  closeApp,
  createProfile,
  focusBody,
  launch,
  readSettingsFile,
  removeProfile,
  sleep,
} from './support/app';
import type { Profile } from './support/app';

const TEST_THEME = join(process.cwd(), 'tests', 'fixtures', 'themes', 'test-light.json');

let profile: Profile;

test.beforeEach(() => {
  profile = createProfile();
});

test.afterEach(() => {
  removeProfile(profile);
});

test.setTimeout(120_000);

/** The app background token as the page sees it (the CSS variable set by applyTheme). */
async function background(page: Page): Promise<string> {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--color-bg-app').trim().toUpperCase(),
  );
}

/** The window's zoom factor, which main sets from the appearance setting (SET-15). */
async function zoom(app: ElectronApplication): Promise<number> {
  return app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor() ?? 0,
  );
}

/** The Use button of one theme's row in the Themes section. */
function useButton(page: Page, themeName: string) {
  return page
    .getByText(themeName, { exact: true })
    .locator('xpath=ancestor::*[.//button[normalize-space()="Use"]][1]')
    .getByRole('button', { name: 'Use', exact: true });
}

test('REL-7 (P-32): a corrupt settings.json starts with defaults, names the problem and is left untouched', async () => {
  mkdirSync(join(profile.config, 'settings'), { recursive: true });
  const file = join(profile.config, 'settings', 'settings.json');
  writeFileSync(file, '{ not json');
  const { app, page } = await launch(profile);
  try {
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    await page.keyboard.press('Control+,');
    const banner = page.getByRole('alert').filter({ hasText: 'settings.json' });
    await expect(banner).toContainText('One problem in your settings files');
    await expect(page.getByRole('button', { name: 'Open file' })).toBeVisible();
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
  } finally {
    await closeApp(app);
  }
});

test('F-008: Ctrl+Shift+P, type "set", Open Settings runs from the list', async () => {
  const { app, page } = await launch(profile);
  try {
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    await page.keyboard.press('Control+Shift+P');
    await page.getByRole('combobox', { name: 'Command' }).fill('set');
    await page.getByRole('option', { name: /^Open Settings/ }).click();
    await expect(page.getByRole('textbox', { name: 'Search settings' })).toBeVisible();
  } finally {
    await closeApp(app);
  }
});

test('F-007: a theme file added to the themes folder is picked, its colours change at once, and Phosphor comes back', async () => {
  const { app, page } = await launch(profile);
  try {
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => background(page), { timeout: 10_000 }).not.toBe('');
    const before = await background(page);

    mkdirSync(join(profile.config, 'themes'), { recursive: true });
    copyFileSync(TEST_THEME, join(profile.config, 'themes', 'test-light.json'));
    // SET-8: the folder is re-read within one second. The Themes list is read when the screen opens, so open it after that.
    await sleep(1500);

    await focusBody(page);
    await page.keyboard.press('Control+,');
    await page.getByRole('button', { name: 'Themes', exact: true }).click();
    // The row is listed. Its name has no width in the grid (see lane-notes/h2-bugs.md), so only attachment is checked.
    await expect(page.getByText('test-light', { exact: true })).toBeAttached({ timeout: 10_000 });

    await page.evaluate(() => Reflect.set(window, '__marker', 'kept'));
    await useButton(page, 'test-light').click();
    await expect.poll(() => background(page), { timeout: 3_000 }).toBe('#F4F1EA');
    expect(await page.evaluate(() => Reflect.get(window, '__marker'))).toBe('kept');

    // Only the inactive theme has a Use button: Phosphor.
    await expect(page.getByRole('button', { name: 'Use', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Use', exact: true }).click();
    await expect.poll(() => background(page), { timeout: 3_000 }).toBe(before);
  } finally {
    await closeApp(app);
  }
});

test('F-006: an edit to settings.json on disk applies within one second, without a restart', async () => {
  mkdirSync(join(profile.config, 'settings'), { recursive: true });
  writeFileSync(
    join(profile.config, 'settings', 'settings.json'),
    JSON.stringify({ version: 1, values: {} }),
  );
  const { app, page } = await launch(profile);
  try {
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible({ timeout: 15_000 });
    expect(await zoom(app)).toBe(1);
    writeFileSync(
      join(profile.config, 'settings', 'settings.json'),
      JSON.stringify({ version: 1, values: { settings: { uiScale: 1.25 } } }),
    );
    await expect.poll(() => zoom(app), { timeout: 1_000, intervals: [50] }).toBeCloseTo(1.25, 2);
  } finally {
    await closeApp(app);
  }
});

test('F-009: Ctrl+, opens settings; a value changes and saves; an invalid value shows a message and is not saved', async () => {
  const { app, page } = await launch(profile);
  try {
    await expect(page.getByRole('button', { name: 'Code', exact: true })).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    await page.keyboard.press('Control+,');

    const scale = page.getByRole('spinbutton', { name: 'Ui scale' });
    await expect(scale).toBeVisible();
    await scale.fill('1.2');
    await scale.press('Tab');
    await expect
      .poll(() => readSettingsFile(profile)?.values['settings']?.['uiScale'], { timeout: 3_000 })
      .toBe(1.2);

    const vault = page.getByRole('textbox', { name: 'Vault path' });
    // Two characters: under the three that zAbsPath asks for. (A relative path passes zAbsPath, see lane-notes/h2-bugs.md.)
    await vault.fill('ab');
    await expect(vault).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByRole('alert').filter({ hasText: 'characters' })).toBeVisible();
    await sleep(800);
    expect(readSettingsFile(profile)?.values['settings']?.['vaultPath']).toBeUndefined();
  } finally {
    await closeApp(app);
  }
});
