import { _electron as electron, expect, test } from '@playwright/test';

test('card 005: 10 MB of ordered binary messages reach the renderer from pty-host', async () => {
  const app = await electron.launch({ args: ['.'] });
  const page = await app.firstWindow();
  await expect(page.getByText('ports-ok 10000000')).toBeVisible({ timeout: 10_000 });
  await app.close();
});
