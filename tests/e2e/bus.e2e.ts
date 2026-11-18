import { _electron as electron, expect, test } from '@playwright/test';

test('card 010: the renderer calls shell.ping on all three services and gets three answers', async () => {
  const app = await electron.launch({ args: ['.'], env: { ...process.env, HSOS_E2E: '1' } });
  const page = await app.firstWindow();
  await expect(page.getByText('pong pty-host, pong workspace-service, pong link-service')).toBeVisible({
    timeout: 10_000,
  });
  await app.close();
});
