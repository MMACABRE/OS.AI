import { expect, test } from '@playwright/test';
import {
  backdropStats,
  closeApp,
  createProfile,
  focusBody,
  installBackdropProbe,
  launch,
  removeProfile,
  sleep,
} from './support/app';
import type { Profile } from './support/app';

let profile: Profile;

test.beforeEach(() => {
  profile = createProfile();
});

test.afterEach(() => {
  removeProfile(profile);
});

test.setTimeout(120_000);

// UI-32 bug: a minimised window keeps drawing; document.hidden stays false, so the worker is never paused. See lane-notes/h2-bugs.md.
test.fixme('UI-32: a minimised window draws no background frame for 2 s', async () => {
  const { app, page } = await launch(profile, { demo: true });
  try {
    await installBackdropProbe(page);
    await expect(page.locator('section[aria-label="code page"]')).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    const running = await backdropStats(page);
    await sleep(1000);
    expect((await backdropStats(page)).frames).toBeGreaterThan(running.frames);

    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.minimize());
    await sleep(800);
    const minimised = await backdropStats(page);
    await sleep(2000);
    expect((await backdropStats(page)).frames).toBe(minimised.frames);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.restore());
  } finally {
    await closeApp(app);
  }
});

// UI-32 / MOT-12 bug: with data-motion="reduced" the worker keeps drawing about 30 frames a second. See lane-notes/h2-bugs.md.
test('UI-32: with reduced motion the background draws one frame and stops', async () => {
  const { app, page } = await launch(profile, { demo: true });
  try {
    await installBackdropProbe(page);
    await expect(page.locator('section[aria-label="code page"]')).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    // The theme's settings reach the worker a moment after start; wait for them, or they reset data-motion.
    await expect.poll(async () => (await backdropStats(page)).scene, { timeout: 15_000 }).toBe('phosphor-dust');
    const before = await backdropStats(page);
    await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduced'));
    await sleep(500);
    const drawn = await backdropStats(page);
    // Only one frame may be drawn after the switch; the normal rate would add about 15 in 500 ms.
    expect(drawn.frames - before.frames).toBeLessThanOrEqual(2);
    await sleep(2000);
    expect((await backdropStats(page)).frames).toBe(drawn.frames);
  } finally {
    await closeApp(app);
  }
});
