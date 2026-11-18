import { _electron as electron, expect, test } from '@playwright/test';

// Card 006: passed once against the spike in src/main/index.ts, which the card then removes.
test.skip('card 006: a WebContentsView returns a screenshot through the DevTools Protocol', async () => {
  const app = await electron.launch({ args: ['.'] });
  let log = '';
  app.process().stdout?.on('data', (data: Buffer) => (log += String(data)));
  await app.firstWindow();
  await expect.poll(() => /browser-spike screenshot (\d+)/.exec(log)?.[1] ?? '0', { timeout: 10_000 }).not.toBe('0');
  const length = Number(/browser-spike screenshot (\d+)/.exec(log)?.[1]);
  await app.close();
  expect(length).toBeGreaterThan(1_000);
});
