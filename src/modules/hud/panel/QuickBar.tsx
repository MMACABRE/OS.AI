import { useState } from 'react';
import type { ReactElement } from 'react';
import type { ClaudeSession } from '@hsos/contracts/channels/claude-link';
import { terminalChannels } from '@hsos/contracts/channels/terminal';
import { Button, Dialog, Menu, Popover, ProgressBar, TextField, Tooltip, useToast } from '@hsos/ui-kit';
import type { MenuItem } from '@hsos/ui-kit';
import { useHudDeps } from './hud-context';
import { targetSession, useHudData } from './hud-data';
import { cacheState, contextToneClass } from './SessionsSection';
import { cleanFreeText, QUICK_WORD, sendToSession } from './send-command';
import { usageTone } from './UsageSection';
import styles from './Hud.module.css';

const MODE_LABELS: Readonly<Record<string, string>> = {
  default: 'Default',
  acceptEdits: 'Accept edits',
  plan: 'Plan',
  auto: 'Auto',
  dontAsk: "Don't ask",
  bypassPermissions: 'Bypass',
};

const NO_TARGET = 'Start a Claude session first';

/** `41k of 200k tokens` (HUD-61). */
export function tokensText(tokens: number | null, window: number | null): string {
  if (tokens === null || window === null) return 'No data yet';
  const k = (value: number) => `${Math.round(value / 1000)}k`;
  return `${k(tokens)} of ${k(window)} tokens`;
}

/** The quick bar (HUD-60 to HUD-68): the speed dial, then buttons acting on the target session. */
export function QuickBar({ onSearchSkills }: { readonly onSearchSkills: () => void }) {
  const deps = useHudDeps();
  const toast = useToast();
  const sessions = useHudData((state) => state.sessions);
  const focusOrder = useHudData((state) => state.focusOrder);
  const usage = useHudData((state) => state.usage);
  const settings = useHudData((state) => state.settings);
  const target = targetSession(sessions, focusOrder);
  const [dialog, setDialog] = useState<'compact' | 'clear' | null>(null);
  const [keep, setKeep] = useState('');

  const send = (session: ClaudeSession | null, command: string) => {
    if (session === null || !QUICK_WORD.test(command.split(' ')[0] ?? '')) return;
    void sendToSession(deps.bus, session, command, toast);
  };

  const usagePercent =
    usage.kind === 'ready'
      ? Math.max(usage.value.fiveHour?.usedPercentage ?? 0, usage.value.sevenDay?.usedPercentage ?? 0)
      : null;
  const usageClass = usagePercent === null ? styles.muted : styles[usageTone(usagePercent, settings.warnAt, settings.dangerAt)];
  const context = target?.contextUsedPercentage ?? null;
  const disabled = target === null;

  const modelItems: MenuItem[] = [
    ...settings.quickModels.map((name) => ({
      label: `${target !== null && ((target.modelId ?? '').includes(name) || (target.model ?? '').toLowerCase().includes(name)) ? '✓ ' : '   '}${name}`,
      onSelect: () => send(target, `/model ${name}`),
    })),
    { separator: true },
    ...settings.quickEfforts.map((level) => ({
      label: `${target?.effort === level ? '✓ ' : '   '}${level}`,
      onSelect: () => send(target, `/effort ${level}`),
    })),
  ];
  const moreItems: MenuItem[] = [
    { label: 'Session history', disabled: !deps.hasCommand('sessions.history'), onSelect: () => deps.runCommand('sessions.history') },
    { label: 'Find session', disabled: !deps.hasCommand('sessions.find'), onSelect: () => deps.runCommand('sessions.find') },
    { separator: true },
    ...settings.quickCommands.map((command) => ({ label: command, disabled, onSelect: () => send(target, command) })),
  ];

  const cycleMode = () => {
    if (target === null || target.terminalId === null) return;
    if (target.activity === 'needs-you' || target.activity === 'ended') {
      send(target, '/status');
      return;
    }
    void deps.bus.call(terminalChannels.write, { id: target.terminalId, data: '\u001b[Z', source: 'quick-command' });
  };

  const off = (node: ReactElement) => (disabled ? <Tooltip text={NO_TARGET}>{node}</Tooltip> : node);

  return (
    <div className={styles.quick}>
      <div className={styles.quickTitle}>{target === null ? NO_TARGET : target.title || 'Untitled session'}</div>
      <div className={styles.quickRow}>
        <Popover
          label="Usage"
          content={
            <div className={styles.popover}>
              {usage.kind !== 'ready' ? (
                <span className={styles.muted}>No data yet</span>
              ) : (
                (['fiveHour', 'sevenDay'] as const).map((which) => {
                  const window = usage.value[which];
                  const label = which === 'fiveHour' ? '5 hours' : '7 days';
                  return (
                    <div key={which} className={styles.field}>
                      <span>
                        {label} {window === null ? '–' : `${Math.round(window.usedPercentage)}%`}
                      </span>
                      <ProgressBar
                        value={(window?.usedPercentage ?? 0) / 100}
                        tone={window === null ? 'info' : usageTone(window.usedPercentage, settings.warnAt, settings.dangerAt)}
                        label={label}
                      />
                    </div>
                  );
                })
              )}
              <Button size="small" disabled={disabled} onPress={() => send(target, '/usage')}>
                Open /usage in Claude
              </Button>
            </div>
          }
        >
          <button type="button" className={styles.chip}>
            Usage <span className={usageClass}>{usagePercent === null ? '?' : `${Math.round(usagePercent)}%`}</span>
          </button>
        </Popover>
        <Popover
          label="Context"
          content={
            <div className={styles.popover}>
              {target === null || context === null ? (
                <span className={styles.muted}>No data yet</span>
              ) : (
                <>
                  <ProgressBar value={context / 100} tone={context >= 90 ? 'danger' : context >= 70 ? 'warn' : 'ok'} label="Context used" />
                  <span>{tokensText(target.contextTokens, target.contextWindowSize)}</span>
                  <span className={styles.muted}>Cache: {cacheState(target.lastResponseAt, Date.now())}</span>
                </>
              )}
              <Button size="small" disabled={disabled} onPress={() => send(target, '/context')}>
                Open /context in Claude
              </Button>
              <Button size="small" disabled={disabled} onPress={() => setDialog('compact')}>
                Compact…
              </Button>
            </div>
          }
        >
          <button type="button" className={styles.chip}>
            Context <span className={context === null ? styles.muted : contextToneClass(context)}>{context === null ? '–' : `${Math.round(context)}%`}</span>
          </button>
        </Popover>
        <button type="button" className={styles.chip} onClick={onSearchSkills}>
          Skills
        </button>
      </div>
      <div className={styles.quickRow}>
        {off(
          <span>
            <Menu items={modelItems}>
              <button type="button" className={styles.chip} disabled={disabled}>
                {target?.model ?? 'Model'}
                {target?.effort === null || target?.effort === undefined ? '' : ` · ${target.effort}`} ▾
              </button>
            </Menu>
          </span>,
        )}
        <Tooltip text={disabled ? NO_TARGET : 'As Claude last reported it'}>
          <button
            type="button"
            className={styles.chip}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={cycleMode}
          >
            {MODE_LABELS[target?.permissionMode ?? 'default'] ?? target?.permissionMode} ⇄
          </button>
        </Tooltip>
        {off(
          <button type="button" className={styles.chip} disabled={disabled} onClick={() => setDialog('compact')}>
            Compact
          </button>,
        )}
        {off(
          <button type="button" className={styles.chip} disabled={disabled} onClick={() => setDialog('clear')}>
            Clear
          </button>,
        )}
        <Menu items={moreItems}>
          <button type="button" className={styles.chip}>
            More ▾
          </button>
        </Menu>
      </div>
      {dialog === 'compact' ? (
        <Dialog
          title="Compact this conversation?"
          onClose={() => setDialog(null)}
          initialFocus={() => document.querySelector<HTMLElement>('[data-hud-cancel]')}
          actions={
            <>
              <span data-hud-cancel="">
                <Button onPress={() => setDialog(null)}>Cancel</Button>
              </span>
              <Button
                variant="primary"
                onPress={() => {
                  const extra = cleanFreeText(keep);
                  send(target, extra === '' ? '/compact' : `/compact ${extra}`);
                  setKeep('');
                  setDialog(null);
                }}
              >
                Compact
              </Button>
            </>
          }
        >
          <p>
            Claude replaces the conversation so far with a summary to free up context. Details from earlier messages can be
            lost, and writing the summary uses some of your plan&apos;s usage.
          </p>
          <TextField value={keep} onChange={setKeep} label="Keep in the summary" placeholder="Keep in the summary" />
        </Dialog>
      ) : null}
      {dialog === 'clear' ? (
        <Dialog
          title="Clear this conversation?"
          danger
          onClose={() => setDialog(null)}
          initialFocus={() => document.querySelector<HTMLElement>('[data-hud-cancel] button')}
          actions={
            <>
              <span data-hud-cancel="">
                <Button onPress={() => setDialog(null)}>Cancel</Button>
              </span>
              <Button
                variant="danger"
                onPress={() => {
                  send(target, '/clear');
                  setDialog(null);
                }}
              >
                Clear
              </Button>
            </>
          }
        >
          <p>
            Claude starts a new, empty conversation in this terminal. The current one stays saved: you can resume it from
            Session History.
          </p>
        </Dialog>
      ) : null}
    </div>
  );
}
