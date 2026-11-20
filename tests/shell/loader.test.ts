import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { newId } from '@hsos/contracts/ids';
import type { ModuleId, ProjectId } from '@hsos/contracts/ids';
import type { ExtensionPoint, Logger, ServiceContext } from '@hsos/contracts/module';
import { loadModules } from '../../src/modules/shell/loader/load-modules';
import {
  createContributionStore,
  createDataPaths,
  createServiceContext,
} from '../../src/modules/shell/loader/service-context';
import { createUiContext, createUiRegistry } from '../../src/modules/shell/loader/ui-context';
import { createFakeBus } from '../fakes/fake-bus';
import { createFakeClock } from '../fakes/fake-clock';

type Record = { level: string; event: string; data: unknown };

function recordingLogger() {
  const records: Record[] = [];
  const logger: Logger = { log: (level, event, data) => void records.push({ level, event, data }) };
  return { records, logger };
}

describe('module loader', () => {
  it('SHELL-20 a register that throws is logged and skipped; the others still load, in order', () => {
    const order: string[] = [];
    const { records, logger } = recordingLogger();
    const list = [
      { id: 'files' as const, module: { register: () => void order.push('files') } },
      {
        id: 'history' as const,
        module: {
          register: () => {
            order.push('history');
            throw new Error('history broke');
          },
        },
      },
      { id: 'git' as const, module: { register: () => void order.push('git') } },
    ];

    const loaded = loadModules(list, (id) => id, logger);

    expect(order).toEqual(['files', 'history', 'git']);
    expect(loaded).toEqual(['files', 'git']);
    const errors = records.filter((record) => record.level === 'error');
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0]?.data)).toContain('history');
    expect(JSON.stringify(errors[0]?.data)).toContain('history broke');
  });

  it('SHELL-20 each module is registered with the context made for its own id', () => {
    const seen: ModuleId[] = [];
    const list = [
      { id: 'files' as const, module: { register: (ctx: ModuleId) => void seen.push(ctx) } },
      { id: 'git' as const, module: { register: (ctx: ModuleId) => void seen.push(ctx) } },
    ];
    loadModules(list, (id) => id, recordingLogger().logger);
    expect(seen).toEqual(['files', 'git']);
  });

  it('SHELL-20 a thrown value that is not an Error is still logged and skipped', () => {
    const { records, logger } = recordingLogger();
    const list = [
      {
        id: 'files' as const,
        module: {
          register: () => {
            throw 'plain string';
          },
        },
      },
    ];
    expect(loadModules(list, (id) => id, logger)).toEqual([]);
    expect(records.filter((record) => record.level === 'error')).toHaveLength(1);
  });
});

describe('extension points', () => {
  const point: ExtensionPoint<string> = { id: 'test.point' };

  function context(moduleId: ModuleId, store = createContributionStore()): ServiceContext {
    return createServiceContext(moduleId, {
      bus: createFakeBus(),
      clock: createFakeClock(),
      paths: createDataPaths('C:\\cfg', 'C:\\loc'),
      store,
      logFor: () => recordingLogger().logger,
      onStop: () => undefined,
    });
  }

  it('SHELL-20 two modules contribute a then b to one point; contributions returns them in order', () => {
    const store = createContributionStore();
    context('files', store).contribute(point, 'a');
    context('git', store).contribute(point, 'b');
    expect(context('history', store).contributions(point)).toEqual(['a', 'b']);
  });

  it('SHELL-20 a point nobody filled has no contributions, and points do not mix', () => {
    const store = createContributionStore();
    const other: ExtensionPoint<string> = { id: 'test.other' };
    context('files', store).contribute(point, 'a');
    expect(context('git', store).contributions(other)).toEqual([]);
  });

  it('registerSettings returns the section defaults until a settings store is wired', () => {
    const section = {
      moduleId: 'files' as const,
      title: 'Files',
      schema: z.object({ tabSize: z.number() }),
      defaults: { tabSize: 2 },
    };
    const reader = context('files').registerSettings(section);
    expect(reader.get()).toEqual({ tabSize: 2 });
    expect(() => reader.onChange(() => undefined)()).not.toThrow();
  });
});

describe('data paths', () => {
  it('createDataPaths gives workspaceFile as C:\\cfg\\workspaces\\<id>.json', () => {
    const paths = createDataPaths('C:\\cfg', 'C:\\loc');
    const id = newId<ProjectId>(() => 0);
    expect(paths.workspaceFile(id)).toBe(`C:\\cfg\\workspaces\\${id}.json`);
    expect(paths.settingsFile).toBe('C:\\cfg\\settings\\settings.json');
    expect(paths.logsDir).toBe('C:\\loc\\logs');
    expect(paths.crashDir).toBe('C:\\loc\\crash');
  });
});

describe('ui registry', () => {
  const panel = (type: string) => ({
    type,
    kind: 'dock' as const,
    title: 'Panel',
    icon: 'x',
    stateSchema: z.object({}),
    initialState: {},
    component: () => null,
    allowMultiple: false,
  });
  const command = (id: string) => ({
    id,
    title: 'Command',
    defaultKey: null,
    global: false,
    run: () => undefined,
  });
  const statusItem = (id: string) => ({ id, side: 'left' as const, order: 1, component: () => null });

  function uiContext(registry = createUiRegistry(), moduleId: ModuleId = 'files') {
    const { records, logger } = recordingLogger();
    return {
      records,
      registry,
      ctx: createUiContext(moduleId, {
        bus: createFakeBus(),
        clock: createFakeClock(),
        registry,
        logFor: () => logger,
      }),
    };
  }

  it('SHELL-20 createUiRegistry throws on a second panel with the same id', () => {
    const { ctx, registry } = uiContext();
    ctx.registerPanel(panel('files.tree'));
    expect(() => ctx.registerPanel(panel('files.tree'))).toThrow();
    expect([...registry.panels.keys()]).toEqual(['files.tree']);
  });

  it('SHELL-20 createUiRegistry throws on a second command with the same id', () => {
    const { ctx, registry } = uiContext();
    ctx.registerCommand(command('files.open'));
    expect(() => ctx.registerCommand(command('files.open'))).toThrow();
    expect([...registry.commands.keys()]).toEqual(['files.open']);
  });

  it('SHELL-20 createUiRegistry throws on a second status item with the same id', () => {
    const { ctx, registry } = uiContext();
    ctx.registerStatusItem(statusItem('files.count'));
    expect(() => ctx.registerStatusItem(statusItem('files.count'))).toThrow();
    expect([...registry.statusItems.keys()]).toEqual(['files.count']);
  });

  it('SHELL-20 ui settings return the section defaults until card 016 wires them', () => {
    const { ctx } = uiContext();
    const reader = ctx.settings({
      moduleId: 'files',
      title: 'Files',
      schema: z.object({ tabSize: z.number() }),
      defaults: { tabSize: 2 },
    });
    expect(reader.get()).toEqual({ tabSize: 2 });
  });

  it('SHELL-20 openPanel before the workspace is ready only logs; afterwards it calls the opener', () => {
    const { ctx, registry, records } = uiContext();
    ctx.openPanel('files.tree');
    expect(records.map((record) => record.event)).toEqual(['shell.open_panel_early']);

    const opened: unknown[] = [];
    registry.setPanelOpener((type, state) => void opened.push([type, state]));
    ctx.openPanel('files.tree', { a: 1 });
    expect(opened).toEqual([['files.tree', { a: 1 }]]);
  });
});
