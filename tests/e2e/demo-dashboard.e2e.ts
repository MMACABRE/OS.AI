import { expect, test } from '@playwright/test';
import { closeApp, createProfile, focusBody, launch, removeProfile } from './support/app';
import type { Profile } from './support/app';

let profile: Profile;

test.beforeEach(() => {
  profile = createProfile();
});

test.afterEach(() => {
  removeProfile(profile);
});

test.setTimeout(120_000);

// DASH-13 bug: the ribbon click opens the Code page but focus does not reach the session's terminal (focus stays on the ribbon). See lane-notes/h2-bugs.md.
test.fixme('DASH-13: activating the session ribbon widget opens the Code page with its terminal focused', async () => {
  const { app, page } = await launch(profile, { demo: true });
  try {
    await expect(page.locator('section[aria-label="code page"]')).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    await page.keyboard.press('Control+1');
    const ribbon = page.getByLabel('Session ribbon', { exact: true });
    await expect(ribbon).toBeVisible({ timeout: 5_000 });
    await ribbon.click();
    await expect(page.locator('section[aria-label="code page"]')).toBeVisible({ timeout: 3_000 });
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.closest('[data-hsos-terminal]') !== null), {
        timeout: 3_000,
      })
      .toBe(true);
  } finally {
    await closeApp(app);
  }
});
