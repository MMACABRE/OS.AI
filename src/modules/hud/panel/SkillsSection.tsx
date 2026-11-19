import { useState } from 'react';
import type { SkillInfo, SkillRun, SkillState } from '@hsos/contracts/channels/skills';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import type { AbsPath } from '@hsos/contracts/ids';
import {
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  Menu,
  Select,
  Skeleton,
  staggerStyle,
  TextField,
  useToast,
} from '@hsos/ui-kit';
import type { MenuItem } from '@hsos/ui-kit';
import { useHudDeps } from './hud-context';
import { retryHudData, targetSession, useHudData } from './hud-data';
import { focusTerminal } from './send-command';
import { elapsedSince } from './ribbon/Ribbon';
import styles from './Hud.module.css';

type StateFilter = 'all' | SkillState;
type SourceFilter = 'all' | SkillInfo['source'];

/** HUD-30: every typed word in the name or description, in any order, case ignored. */
export function matchesSkill(skill: SkillInfo, query: string): boolean {
  const text = `${skill.name} ${skill.description}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== '')
    .every((word) => text.includes(word));
}

/** HUD-30: favourites first in starred order, then the rest by name. */
export function deckOrder(skills: readonly SkillInfo[]): SkillInfo[] {
  const favourites = skills.filter((skill) => skill.isFavourite);
  const rest = skills.filter((skill) => !skill.isFavourite).sort((a, b) => a.name.localeCompare(b.name));
  return [...favourites, ...rest];
}

const STATE_CHIPS: Readonly<Partial<Record<SkillState, string>>> = {
  'name-only': 'name only',
  'user-invocable-only': 'you only',
  off: 'off',
};

/** HUD-37: the four state choices and the line under each. */
const STATE_CHOICES: readonly { state: SkillState; label: string; line: string }[] = [
  { state: 'on', label: 'On', line: 'Claude sees it and can use it.' },
  { state: 'name-only', label: 'Name only', line: 'Claude sees the name but not the description, which saves context.' },
  { state: 'user-invocable-only', label: 'You only', line: 'Hidden from Claude. You can still run /name.' },
  { state: 'off', label: 'Off', line: 'Hidden from Claude and from you.' },
];

const LOCK_REASONS: Readonly<Record<NonNullable<SkillInfo['stateLock']>, string>> = {
  policy: 'Set by your organisation policy.',
  plugin: 'Set by its plugin.',
  author: 'Its author fixed this state.',
};

const RUN_MODELS = ['sonnet', 'opus', 'haiku'];

/** Focuses the deck's search field, for `hud.searchSkills` (HUD-61). */
export function focusSkillSearch(): void {
  const field = document.querySelector<HTMLInputElement>('input[aria-label="Search skills"]');
  field?.scrollIntoView({ block: 'nearest' });
  field?.focus();
}

/** The skills deck (HUD-30 to HUD-37). */
export function SkillsDeck() {
  const deps = useHudDeps();
  const toast = useToast();
  const skills = useHudData((state) => state.skills);
  const runs = useHudData((state) => state.runs);
  const sessions = useHudData((state) => state.sessions);
  const focusOrder = useHudData((state) => state.focusOrder);
  const project = useHudData((state) => state.project);
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [running, setRunning] = useState<SkillInfo | null>(null);
  const [report, setReport] = useState<SkillRun | null>(null);

  if (skills.kind === 'loading') return <Skeleton rows={4} label="Reading skills" />;
  if (skills.kind === 'error')
    return <ErrorState message="Skills could not be read." onRetry={() => retryHudData(deps.bus, 'skills')} />;

  // HUD-31: `/<name> ` (no Enter) goes to the target terminal, which then gets focus.
  const use = (skill: SkillInfo) => {
    const target = targetSession(sessions, focusOrder);
    if (target === null || target.terminalId === null) {
      toast.show({
        tone: 'info',
        message: 'Start a Claude session first',
        action: deps.hasCommand('terminal.newClaude')
          ? { label: 'New Claude Session', onPress: () => deps.runCommand('terminal.newClaude') }
          : undefined,
      });
      return;
    }
    const terminalId = target.terminalId;
    void deps.bus
      .call(terminalChannels.write, { id: terminalId, data: `/${skill.name} `, source: 'owner' })
      .then(() => focusTerminal(terminalId));
  };

  const setState = async (skill: SkillInfo, state: SkillState, scope: 'user' | 'project-local') => {
    const result = await deps.bus.call(skillsChannels.setState, { name: skill.name, state, scope });
    if (result.ok) toast.show({ tone: 'ok', message: 'Saved. New Claude sessions use it; a running session may need restarting.' });
    else toast.show({ tone: 'error', message: result.error.message });
  };

  const menuFor = (skill: SkillInfo): MenuItem[] => {
    const locked = skill.stateLock !== null;
    const scope = skill.stateSource === 'default' ? 'user' : 'project-local';
    return [
      { label: 'Open SKILL.md', icon: 'file-markdown', onSelect: () => deps.openPanel('files.viewer', { path: skill.file }) },
      {
        label: 'Show in folder',
        icon: 'folder-open',
        onSelect: () => void deps.bus.call(shellChannels.revealInExplorer, { path: skill.file }),
      },
      { separator: true },
      ...STATE_CHOICES.map((choice) => ({
        label: `${choice.state === skill.state ? '✓ ' : '   '}${choice.label} — ${choice.line}`,
        disabled: locked,
        onSelect: () => void setState(skill, choice.state, scope),
      })),
      ...(skill.stateSource === 'default' && !locked
        ? [
            { separator: true as const },
            { label: 'For all projects', onSelect: () => undefined, disabled: true },
            {
              label: 'For this project only',
              onSelect: () => void setState(skill, skill.state, 'project-local'),
            },
          ]
        : []),
      { separator: true },
      {
        label: locked
          ? (LOCK_REASONS[skill.stateLock ?? 'policy'] ?? '')
          : skill.stateSource === 'default'
            ? 'Not saved in any file yet'
            : `Saved in ${skill.stateSource} settings`,
        disabled: true,
        onSelect: () => undefined,
      },
    ];
  };

  const shown = deckOrder(
    skills.value.filter(
      (skill) =>
        matchesSkill(skill, query) &&
        (stateFilter === 'all' || skill.state === stateFilter) &&
        (sourceFilter === 'all' || skill.source === sourceFilter),
    ),
  );
  const runList = [...runs.values()].filter((run) => run.state !== 'cancelled');

  return (
    <div className={styles.deck}>
      <TextField value={query} onChange={setQuery} placeholder="Search skills…" label="Search skills" />
      <div className={styles.filters} role="group" aria-label="Filter by state and source">
        {(['all', 'on', 'name-only', 'user-invocable-only', 'off'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.filter} ${stateFilter === value ? styles.filterOn : ''}`}
            aria-pressed={stateFilter === value}
            onClick={() => setStateFilter(value)}
          >
            {value === 'all' ? 'All' : (STATE_CHOICES.find((choice) => choice.state === value)?.label ?? value)}
          </button>
        ))}
        {(['all', 'user', 'project', 'plugin'] as const).map((value) => (
          <button
            key={`source-${value}`}
            type="button"
            className={`${styles.filter} ${sourceFilter === value ? styles.filterOn : ''}`}
            aria-pressed={sourceFilter === value}
            onClick={() => setSourceFilter(value)}
          >
            {value === 'all' ? 'Any source' : value[0]?.toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      {runList.length === 0 ? null : (
        <ul className={styles.rows} aria-label="Background runs">
          {runList.map((run) => (
            <li key={run.id} className={styles.runRow}>
              <span className={styles.skillName}>{run.skill}</span>
              <span className={run.state === 'failed' ? styles.danger : run.state === 'succeeded' ? styles.ok : styles.muted}>
                {run.state}
              </span>
              <span className={styles.muted}>{run.startedAt === null ? '' : elapsedSince(run.startedAt, run.endedAt ?? Date.now())}</span>
              <span className={styles.grow} />
              {run.state === 'running' || run.state === 'queued' ? (
                <Button size="small" variant="ghost" onPress={() => void deps.bus.call(skillsChannels.cancelRun, { id: run.id })}>
                  Cancel
                </Button>
              ) : (
                <>
                  <Button size="small" variant="ghost" onPress={() => setReport(run)}>
                    View report
                  </Button>
                  <Button
                    size="small"
                    variant="ghost"
                    onPress={() =>
                      useHudData.setState((state) => {
                        const next = new Map(state.runs);
                        next.delete(run.id);
                        return { runs: next };
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {shown.length === 0 ? (
        <EmptyState
          title="No skills"
          message={query === '' && stateFilter === 'all' && sourceFilter === 'all' ? 'No skills found.' : 'No skill matches.'}
        />
      ) : (
        <ul className={styles.rows} aria-label="Skills">
          {shown.map((skill, index) => {
            const chip = STATE_CHIPS[skill.state];
            return (
              <li key={skill.name} className={styles.skillRow} style={staggerStyle(index)}>
                <button
                  type="button"
                  className={`${styles.star} ${skill.isFavourite ? styles.starOn : ''}`}
                  aria-label={skill.isFavourite ? `Unstar ${skill.name}` : `Star ${skill.name}`}
                  aria-pressed={skill.isFavourite}
                  onClick={() =>
                    void deps.bus.call(skillsChannels.setFavourite, { name: skill.name, isFavourite: !skill.isFavourite })
                  }
                >
                  <Icon name={skill.isFavourite ? 'star-filled' : 'star'} size={16} />
                </button>
                <button type="button" className={styles.skillMain} onClick={() => use(skill)} title={skill.description}>
                  <span className={styles.skillName}>{skill.name}</span>
                  {chip === undefined ? null : (
                    <span className={`${styles.stateChip} ${skill.state === 'off' ? styles.stateOff : ''}`}>{chip}</span>
                  )}
                  <span className={styles.skillDescription}>{skill.description}</span>
                </button>
                <span>
                  <IconButton icon={<Icon name="play" />} label="Run in background" onPress={() => setRunning(skill)} />
                  <Menu items={menuFor(skill)}>
                    <IconButton icon={<Icon name="more" />} label={`More for ${skill.name}`} onPress={() => undefined} />
                  </Menu>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {running === null ? null : (
        <RunDialog skill={running} cwd={project?.path ?? null} onClose={() => setRunning(null)} />
      )}
      {report === null ? null : (
        <Dialog
          title={`${report.skill} report`}
          onClose={() => setReport(null)}
          actions={<Button onPress={() => setReport(null)}>Close</Button>}
        >
          <p className={styles.muted}>{report.failure ?? ''}</p>
          <pre className={styles.title}>{report.report ?? 'No report.'}</pre>
        </Dialog>
      )}
    </div>
  );
}

/** HUD-32: the "Run in background" dialog. */
function RunDialog({ skill, cwd, onClose }: { readonly skill: SkillInfo; readonly cwd: AbsPath | null; readonly onClose: () => void }) {
  const deps = useHudDeps();
  const toast = useToast();
  const [args, setArgs] = useState('');
  const [model, setModel] = useState(RUN_MODELS[0] ?? 'sonnet');
  const start = async () => {
    if (cwd === null) return;
    const result = await deps.bus.call(skillsChannels.startRun, { skill: skill.name, args, model, effort: null, cwd });
    if (!result.ok) toast.show({ tone: 'error', message: result.error.message });
    onClose();
  };
  return (
    <Dialog
      title={`Run ${skill.name}`}
      onClose={onClose}
      actions={
        <>
          <Button onPress={onClose}>Cancel</Button>
          <Button variant="primary" disabled={cwd === null} onPress={() => void start()}>
            Run
          </Button>
        </>
      }
    >
      <div className={styles.popover}>
        <TextField value={args} onChange={setArgs} label="Arguments" placeholder="Arguments" />
        <Select value={model} options={RUN_MODELS.map((value) => ({ value, label: value }))} onChange={setModel} label="Model" />
        <p className={styles.muted}>This starts a separate Claude run on {model} and uses your plan&apos;s usage.</p>
      </div>
    </Dialog>
  );
}

/** The skills repo row (HUD-40, HUD-41). */
export function SkillsRepoRow() {
  const deps = useHudDeps();
  const sync = useHudData((state) => state.repoSync);
  const [confirm, setConfirm] = useState(false);
  if (sync.kind === 'loading') return <div className={styles.repoRow}>Checking…</div>;
  if (sync.kind === 'error')
    return (
      <div className={styles.repoRow}>
        <span className={styles.danger}>{sync.message}</span>
        <Button size="small" onPress={() => retryHudData(deps.bus, 'repo')}>
          Retry
        </Button>
      </div>
    );
  const repo = sync.value;
  const check = () => void deps.bus.call(skillsChannels.checkRepoSync, {});
  switch (repo.state) {
    case 'not-configured':
      return (
        <div className={styles.repoRow}>
          <span className={styles.muted}>Skills repo not found</span>
          <span className={styles.grow} />
          <Button size="small" onPress={() => deps.openPanel('settings.screen')}>
            Settings
          </Button>
        </div>
      );
    case 'checking':
    case 'syncing':
      return <div className={styles.repoRow}>{repo.state === 'checking' ? 'Checking…' : 'Syncing…'}</div>;
    case 'error':
      return (
        <div className={styles.repoRow}>
          <span className={styles.danger}>{repo.error ?? 'The skills repo could not be checked.'}</span>
          <span className={styles.grow} />
          <Button size="small" onPress={check}>
            Retry
          </Button>
        </div>
      );
    case 'out-of-sync': {
      const parts = [
        repo.changed.length > 0 ? `${repo.changed.length} changed` : null,
        repo.added.length > 0 ? `${repo.added.length} new` : null,
        repo.removed.length > 0 ? `${repo.removed.length} only in repo` : null,
        `↑${repo.ahead} ↓${repo.behind}`,
      ].filter((part) => part !== null);
      const folders = [...repo.changed, ...repo.added];
      return (
        <div className={styles.repoRow} title={repo.removed.length > 0 ? `Only in the repo: ${repo.removed.join(', ')}` : undefined}>
          <span className={styles.warn}>{parts.join(' · ')}</span>
          <span className={styles.grow} />
          <Button size="small" variant="primary" onPress={() => setConfirm(true)}>
            Sync
          </Button>
          {confirm ? (
            <ConfirmDialog
              title="Push your skills?"
              body={`These folders go to the skills repo: ${folders.join(', ') || 'none'}.`}
              confirmLabel="Sync"
              onConfirm={() => {
                setConfirm(false);
                void deps.bus.call(skillsChannels.pushToRepo, {});
              }}
              onCancel={() => setConfirm(false)}
            />
          ) : null}
        </div>
      );
    }
    default:
      return (
        <div className={styles.repoRow}>
          <span className={styles.ok}>
            <Icon name="check" size={8} /> In sync
          </span>
          <span className={styles.grow} />
          <Button size="small" onPress={check}>
            Check
          </Button>
        </div>
      );
  }
}
