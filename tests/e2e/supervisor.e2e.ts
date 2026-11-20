import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import {
  PONG_ALL,
  closeApp,
  createProfile,
  launch,
  removeProfile,
  servicePid,
  crashFiles,
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

/** Every log line the file logger wrote under %LOCALAPPDATA%\HSOS\logs. */
function logText(root: Profile): string {
  const dir = join(root.local, 'logs');
  if (!existsSync(dir)) return '';
  return readdirSync(dir)
    .map((name) => readFileSync(join(dir, name), 'utf8'))
    .join('\n');
}

test('SHELL-10 (F-004): a killed workspace-service leaves a crash file and is ready again within 5 s', async () => {
  const { app, page } = await launch(profile, { e2e: true });
  try {
    await expect(page.getByText(PONG_ALL)).toBeVisible({ timeout: 15_000 });
    const pid = await servicePid(app, 'workspace-service');
    expect(pid).not.toBeNull();
    const killedAt = Date.now();
    process.kill(pid ?? 0);

    // DIAG-7: the death is reported as a crash file named after the process.
    await expect
      .poll(() => crashFiles(profile).filter((name) => name.endsWith('-workspace-service.json')), {
        timeout: 5_000,
      })
      .toHaveLength(1);
    const [report] = crashFiles(profile).filter((name) => name.endsWith('-workspace-service.json'));
    const crash = JSON.parse(readFileSync(join(profile.local, 'crash', report ?? ''), 'utf8')) as {
      process: string;
    };
    expect(crash.process).toBe('workspace-service');

    // SHELL-10: started again at once; a fresh ping from the renderer answers for all three.
    await expect
      .poll(
        async () => {
          const next = await servicePid(app, 'workspace-service');
          return next !== null && next !== pid;
        },
        { timeout: 5_000, intervals: [100] },
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByText(PONG_ALL)).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - killedAt).toBeLessThan(5_000);
  } finally {
    await closeApp(app);
  }
});

/** Runs script in the window's page from the main process; Playwright's page is lost with a crashed renderer. */
async function pageEval<T>(app: ElectronApplication, script: string): Promise<T | null> {
  return app
    .evaluate(async ({ BrowserWindow }, code) => {
      const window = BrowserWindow.getAllWindows()[0];
      return window === undefined ? null : window.webContents.executeJavaScript(code);
    }, script)
    .then((value) => value as T | null)
    .catch(() => null);
}

test('SHELL-14: a lost renderer reloads, and the three services answer again', async () => {
  const { app, page } = await launch(profile, { e2e: true });
  try {
    await expect(page.getByText(PONG_ALL)).toBeVisible({ timeout: 15_000 });
    await pageEval(app, 'window.__beforeLoss = true');
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.webContents.forcefullyCrashRenderer(),
    );
    // The window reloads the page: the marker set before the crash is gone, and the ping line comes back.
    await expect
      .poll(() => pageEval<boolean>(app, 'window.__beforeLoss === true'), {
        timeout: 10_000,
        intervals: [200],
      })
      .toBe(false);
    await expect
      .poll(() => pageEval<string>(app, 'document.body.innerText'), { timeout: 15_000, intervals: [200] })
      .toContain(PONG_ALL);
  } finally {
    await closeApp(app);
  }
});

// Playwright sets NODE_OPTIONS for its own loader, so the throw-once hook never loads in the app's processes.
// Needs a trigger that does not depend on NODE_OPTIONS (owner or spec decision). See lane-notes/h2-bugs.md.
test.fixme('DIAG-8: a service that throws an uncaught exception logs it and exits with 70; the supervisor restarts it', async () => {
  const marker = join(profile.root, 'throw-once');
  const hook = join(process.cwd(), 'tests', 'e2e', 'support', 'throw-once.cjs').replace(/\\/g, '/');
  const { app, page } = await launch(profile, {
    e2e: true,
    env: {
      NODE_OPTIONS: `--require ${hook}`,
      HSOS_E2E_THROW_IN: 'workspace-service',
      HSOS_E2E_THROW_MARKER: marker,
    },
  });
  try {
    await expect.poll(() => existsSync(marker), { timeout: 15_000, intervals: [100] }).toBe(true);
    // DIAG-8: exit code 70, with the stack in the log (DIAG-1 file logger).
    await expect
      .poll(() => crashFiles(profile).filter((name) => name.endsWith('-workspace-service.json')), {
        timeout: 10_000,
      })
      .toHaveLength(1);
    const [report] = crashFiles(profile).filter((name) => name.endsWith('-workspace-service.json'));
    const crash = JSON.parse(readFileSync(join(profile.local, 'crash', report ?? ''), 'utf8')) as {
      exitCode: number;
    };
    expect(crash.exitCode).toBe(70);
    expect(logText(profile)).toContain('uncaught_exception');
    expect(logText(profile)).toContain('deliberate uncaught exception (DIAG-8)');
    await expect(page.getByText(PONG_ALL)).toBeVisible({ timeout: 15_000 });
  } finally {
    await closeApp(app);
  }
});
