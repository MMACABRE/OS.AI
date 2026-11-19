import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { claudeLinkChannels } from '@hsos/contracts/channels/claude-link';
import type { ClaudeSetup, LastUse } from '@hsos/contracts/channels/claude-link';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { AbsPath } from '@hsos/contracts/ids';
import type { PanelProps } from '@hsos/contracts/module';
import { Button, EmptyState, ErrorState, PanelFrame, Select, Skeleton, Switch, TextField, Tooltip, useToast } from '@hsos/ui-kit';
import { useHudDeps } from './hud-context';
import { targetSession, useHudData } from './hud-data';
import { Section } from './Section';
import { focusTerminal } from './send-command';
import styles from './Hud.module.css';

export const SetupViewState = z.object({});
export type SetupViewState = z.infer<typeof SetupViewState>;

/** HUD-55: a focus this long after the last read reads the setup again. */
export const SETUP_REFRESH_MS = 10_000;
/** HUD-53: "Not used in 30 days". */
export const UNUSED_DAYS = 30;

type Row = {
  readonly key: string;
  readonly kind: string;
  readonly name: string;
  readonly scope: string;
  readonly columns: readonly string[];
  readonly file: AbsPath;
  /** Undefined for sections without a "Last used" column (hooks, permissions). */
  readonly lastUse?: LastUse | null;
};

const DAY = 86_400_000;

/** `3 d ago`, `2 h ago`, `just now` or `never seen` (HUD-51). */
export function lastUsedText(lastUse: LastUse | null, now: number): string {
  if (lastUse === null || lastUse.at === null) return 'never seen';
  const minutes = Math.floor((now - lastUse.at) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h ago`;
  return `${Math.floor(minutes / 1440)} d ago`;
}

const counterText = (lastUse: LastUse | null) =>
  lastUse?.source === 'claude' ? 'Counted by Claude Code' : 'Seen by HSOS, in HSOS terminals only';

/** HUD-53: every word in name, target or file, case ignored. */
export function matchesRow(row: Row, query: string): boolean {
  const text = `${row.name} ${row.columns.join(' ')} ${row.file}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter((word) => word !== '').every((word) => text.includes(word));
}

/** The view's sections as rows (HUD-50 to HUD-52). */
export function setupSections(setup: ClaudeSetup, skills: readonly { name: string; source: string; file: AbsPath }[]): readonly { title: string; rows: Row[] }[] {
  return [
    {
      title: 'MCP servers',
      rows: setup.mcpServers.map((server) => ({
        key: `mcp-${server.name}-${server.scope}`,
        kind: 'MCP server',
        name: server.name,
        scope: server.scope,
        columns: [server.transport, server.target],
        file: server.file,
        lastUse: server.lastUse,
      })),
    },
    {
      title: 'Plugins',
      rows: setup.plugins.map((plugin) => ({
        key: `plugin-${plugin.id}`,
        kind: 'plugin',
        name: plugin.id,
        scope: plugin.scope,
        columns: [plugin.version ?? '', plugin.enabled ? 'on' : 'off'],
        file: plugin.file,
        lastUse: plugin.lastUse,
      })),
    },
    {
      title: 'Skills',
      rows: skills.map((skill) => ({
        key: `skill-${skill.name}`,
        kind: 'skill',
        name: skill.name,
        scope: skill.source,
        columns: [skill.source],
        file: skill.file,
        lastUse: setup.skillUse[skill.name] ?? null,
      })),
    },
    {
      title: 'Subagents',
      rows: setup.agents.map((agent) => ({
        key: `agent-${agent.name}-${agent.scope}`,
        kind: 'subagent',
        name: agent.name,
        scope: agent.scope,
        columns: [],
        file: agent.file,
        lastUse: agent.lastUse,
      })),
    },
    {
      title: 'Hooks',
      rows: setup.hooks.map((hook, index) => ({
        key: `hook-${hook.event}-${index}`,
        kind: `hook for ${hook.event}`,
        name: hook.event,
        scope: hook.scope,
        columns: [`${hook.handlers} ${hook.handlers === 1 ? 'handler' : 'handlers'}`],
        file: hook.file,
      })),
    },
    {
      title: 'Permissions',
      rows: setup.permissions.map((permission, index) => ({
        key: `permission-${index}`,
        kind: 'permission rule',
        name: permission.rule,
        scope: permission.scope,
        columns: [permission.effect],
        file: permission.file,
      })),
    },
  ];
}

/** The Claude setup view (`hud.setup`, HUD-50 to HUD-55). It changes nothing (LINK-6). */
export function SetupView({ isFocused }: PanelProps<SetupViewState>) {
  const deps = useHudDeps();
  const toast = useToast();
  const project = useHudData((state) => state.project);
  const skills = useHudData((state) => state.skills);
  const sessions = useHudData((state) => state.sessions);
  const focusOrder = useHudData((state) => state.focusOrder);
  const [setup, setSetup] = useState<{ kind: 'loading' } | { kind: 'ready'; value: ClaudeSetup } | { kind: 'error' }>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [unused, setUnused] = useState(false);
  const [sort, setSort] = useState<'name' | 'least'>('name');
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const lastRead = useRef(0);
  const now = Date.now();

  const read = useCallback(() => {
    if (project === null) return;
    lastRead.current = Date.now();
    setSetup({ kind: 'loading' });
    void deps.bus.call(claudeLinkChannels.getSetup, { projectPath: project.path }).then((result) => {
      setSetup(result.ok ? { kind: 'ready', value: result.value } : { kind: 'error' });
    });
  }, [deps.bus, project]);

  useEffect(read, [read]);
  useEffect(() => {
    if (isFocused && Date.now() - lastRead.current > SETUP_REFRESH_MS) read();
  }, [isFocused, read]);

  // HUD-54: the removal request is typed without Enter into the target terminal.
  const askToRemove = (row: Row) => {
    const target = targetSession(sessions, focusOrder);
    if (target === null || target.terminalId === null) {
      toast.show({ tone: 'info', message: 'Start a Claude session first' });
      return;
    }
    const terminalId = target.terminalId;
    const text = `Remove the ${row.kind} "${row.name}" from my Claude Code setup in ${row.file}. Tell me what else depends on it first.`;
    void deps.bus.call(terminalChannels.write, { id: terminalId, data: text, source: 'owner' }).then(() => focusTerminal(terminalId));
  };

  let body: ReactNode;
  if (setup.kind === 'loading') body = <Skeleton rows={6} label="Reading your Claude Code setup" />;
  else if (setup.kind === 'error') body = <ErrorState message="Could not read your Claude Code setup." onRetry={read} />;
  else {
    const sections = setupSections(setup.value, skills.kind === 'ready' ? skills.value : []);
    const counts = sections.map((section) => `${section.rows.length} ${section.title.toLowerCase()}`).join(' · ');
    const keep = (row: Row) =>
      matchesRow(row, query) &&
      (!unused || row.lastUse === undefined || row.lastUse === null || row.lastUse.at === null || now - row.lastUse.at > UNUSED_DAYS * DAY);
    const order = (rows: Row[]) =>
      sort === 'name'
        ? [...rows].sort((a, b) => a.name.localeCompare(b.name))
        : [...rows].sort((a, b) => (a.lastUse?.at ?? -1) - (b.lastUse?.at ?? -1));
    body = (
      <div className={styles.hud}>
        <div className={styles.quickRow}>
          <span>{counts}</span>
          <span className={styles.grow} />
          {deps.hasCommand('graph.agentView') ? (
            <Button size="small" onPress={() => deps.runCommand('graph.agentView')}>
              Show what loads at start
            </Button>
          ) : null}
        </div>
        <div className={styles.quickRow}>
          <TextField value={query} onChange={setQuery} placeholder="Search…" label="Search the setup" />
          <Switch checked={unused} onChange={setUnused} label="Not used in 30 days" />
          <Select
            value={sort}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'least', label: 'Least recently used first' },
            ]}
            onChange={setSort}
            label="Sort"
          />
        </div>
        {setup.value.errors.map((error) => (
          <div key={error.file} className={`${styles.repoRow} ${styles.warn}`}>
            Could not read {error.file}: {error.message}
            <Button size="small" variant="ghost" onPress={() => deps.openPanel('files.viewer', { path: error.file })}>
              Open file
            </Button>
          </div>
        ))}
        {sections.map((section) => {
          const rows = order(section.rows.filter(keep));
          const id = section.title;
          return (
            <Section
              key={id}
              title={section.title}
              collapsed={collapsed.has(id)}
              onToggle={() =>
                setCollapsed((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              log={deps.log}
            >
              {rows.length === 0 ? (
                <EmptyState title="None" message="None configured." />
              ) : (
                <ul className={styles.rows}>
                  {rows.map((row) => (
                    <li key={row.key} className={styles.runRow}>
                      <span className={styles.skillName}>{row.name}</span>
                      <span className={styles.muted}>{row.scope}</span>
                      {row.columns.map((column, index) => (
                        <span key={`${row.key}-${index}`}>{column}</span>
                      ))}
                      <span className={styles.grow} />
                      {row.lastUse === undefined ? null : (
                        <Tooltip text={counterText(row.lastUse)}>
                          <span className={styles.muted}>{lastUsedText(row.lastUse, now)}</span>
                        </Tooltip>
                      )}
                      <Button size="small" variant="ghost" onPress={() => deps.openPanel('files.viewer', { path: row.file })}>
                        Open file
                      </Button>
                      <Button size="small" variant="ghost" onPress={() => askToRemove(row)}>
                        Ask Claude to remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          );
        })}
      </div>
    );
  }
  return (
    <PanelFrame
      title="Claude Setup"
      state={{ kind: 'ready' }}
      actions={
        <Button size="small" variant="ghost" onPress={read}>
          Refresh
        </Button>
      }
    >
      {body}
    </PanelFrame>
  );
}
