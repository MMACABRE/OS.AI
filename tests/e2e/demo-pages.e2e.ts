import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
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

const DASHBOARD = 'section[aria-label="dashboard page"]';
const CODE = 'section[aria-label="code page"]';

async function openDemo(): Promise<{ app: Awaited<ReturnType<typeof launch>>['app']; page: Page }> {
  const { app, page } = await launch(profile, { demo: true });
  await expect(page.locator(CODE)).toBeVisible({ timeout: 15_000 });
  return { app, page };
}

test('MOT-5: a page change from Code to Dashboard runs one view transition and shows the Dashboard', async () => {
  const { app, page } = await openDemo();
  try {
    await focusBody(page);
    await page.evaluate(() => {
      Reflect.set(window, '__vtCount', 0);
      const original = document.startViewTransition.bind(document);
      document.startViewTransition = (update?: () => void | Promise<void>) => {
        Reflect.set(window, '__vtCount', Number(Reflect.get(window, '__vtCount')) + 1);
        return original(update);
      };
    });
    // The app's own startup switches also call the transition; count only the calls the key press makes.
    await sleep(1500);
    const before = await page.evaluate(() => Reflect.get(window, '__vtCount'));
    await page.keyboard.press('Control+1');
    await expect(page.locator(DASHBOARD)).toBeVisible({ timeout: 2_000 });
    await sleep(1000);
    expect((await page.evaluate(() => Reflect.get(window, '__vtCount'))) - before).toBe(1);
    await expect(page.locator(CODE)).toBeHidden();
  } finally {
    await closeApp(app);
  }
});

test('MOT-7: three page changes keep the background canvas as the same node and its frame count never falls', async () => {
  const { app, page } = await openDemo();
  try {
    await installBackdropProbe(page);
    await expect(page.locator(CODE)).toBeVisible({ timeout: 15_000 });
    await focusBody(page);
    await sleep(800);
    const canvasBefore = await page.evaluate(() => {
      const canvas = document.querySelector('[data-hsos-backdrop] canvas');
      Reflect.set(window, '__canvas', canvas);
      return canvas !== null;
    });
    expect(canvasBefore).toBe(true);
    const first = await backdropStats(page);
    for (const key of ['Control+1', 'Control+2', 'Control+3']) {
      await page.keyboard.press(key);
      await sleep(400);
    }
    await sleep(500);
    const last = await backdropStats(page);
    expect(last.frames).toBeGreaterThanOrEqual(first.frames);
    expect(last.frames).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.querySelector('[data-hsos-backdrop] canvas') === Reflect.get(window, '__canvas'),
      ),
    ).toBe(true);
  } finally {
    await closeApp(app);
  }
});

test('MOT-11: a key typed into a page during a transition reaches the input before the transition ends', async () => {
  const { app, page } = await openDemo();
  try {
    // A transition that stays open until the test ends it. The update still runs at once (MOT-11: input is never blocked).
    await page.evaluate(() => {
      Reflect.set(window, '__vtStarted', 0);
      document.startViewTransition = (update?: () => void | Promise<void>) => {
        Reflect.set(window, '__vtStarted', Number(Reflect.get(window, '__vtStarted')) + 1);
        const updated = Promise.resolve().then(() => update?.());
        const finished = new Promise<void>((resolve) => Reflect.set(window, '__finishVt', resolve));
        return { ready: updated, updateCallbackDone: updated, finished, skipTransition: () => undefined };
      };
    });
    await focusBody(page);
    await page.keyboard.press('Control+1');
    await expect
      .poll(() => page.evaluate(() => Reflect.get(window, '__vtStarted')), { timeout: 2_000 })
      .toBe(1);
    await expect(page.locator(DASHBOARD)).toBeVisible({ timeout: 2_000 });

    const input = page.locator(`${DASHBOARD} input:visible`).first();
    await input.click();
    await page.keyboard.type('q');
    await expect(input).toHaveValue(/q/);
    // The transition has not finished when the character arrives.
    expect(await page.evaluate(() => Reflect.get(window, '__finishVt') !== undefined)).toBe(true);
    await page.evaluate(() => (Reflect.get(window, '__finishVt') as () => void)());
  } finally {
    await closeApp(app);
  }
});

test('WS-41: going to the Dashboard and back keeps the terminal node and its output', async () => {
  const { app, page } = await openDemo();
  try {
    await focusBody(page);
    const terminal = page.locator('[data-hsos-terminal]').first();
    await expect(terminal).toBeVisible();
    await page.evaluate(() => {
      const node = document.querySelector('[data-hsos-terminal]');
      Reflect.set(window, '__term', node);
      Reflect.set(window, '__termText', document.querySelector('.xterm-rows')?.textContent ?? '');
    });
    await page.keyboard.press('Control+1');
    await expect(page.locator(DASHBOARD)).toBeVisible({ timeout: 2_000 });
    await sleep(3000);
    await page.keyboard.press('Control+2');
    await expect(page.locator(CODE)).toBeVisible({ timeout: 2_000 });
    const result = await page.evaluate(() => ({
      same: document.querySelector('[data-hsos-terminal]') === Reflect.get(window, '__term'),
      kept: (document.querySelector('.xterm-rows')?.textContent ?? '').includes(
        String(Reflect.get(window, '__termText')).slice(0, 40),
      ),
    }));
    expect(result.same).toBe(true);
    expect(result.kept).toBe(true);
  } finally {
    await closeApp(app);
  }
});
