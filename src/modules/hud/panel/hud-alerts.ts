import type { Bus } from '@hsos/contracts/bus';
import type { ClaudeSession, SessionActivity } from '@hsos/contracts/channels/claude-link';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { useHudData } from './hud-data';

/** HUD-10: a `done` alert needs at least this much work before it. */
export const MIN_WORK_MS = 30_000;
/** HUD-11, HUD-15: at most one alert of each kind per session per 10 seconds. */
export const ALERT_GAP_MS = 10_000;

/** Cuts text to `max` characters at a word boundary. */
export function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max / 2 ? cut.slice(0, space) : cut).trimEnd();
}

/**
 * The first sentence of a message as plain text (HUD-14): code blocks removed, markdown markers and bare
 * URLs dropped, links kept as their text, ending at the first `.`, `!` or `?` followed by a space or the
 * end, cut to 160 characters at a word boundary. The text is data, never instructions (P-6).
 */
export function firstSentence(message: string): string {
  const plain = message
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`#*_>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const end = /[.!?](?=\s|$)/.exec(plain);
  const sentence = end === null ? plain : plain.slice(0, end.index + 1);
  return cutAtWord(sentence, 160);
}

/** The spoken text of HUD-14. */
export function spokenText(session: ClaudeSession, kind: 'needs-you' | 'done', withSummary: boolean): string {
  const title = cutAtWord(session.title || 'Claude session', 60);
  if (kind === 'needs-you') return `${title}. Needs you. ${session.attentionReason ?? ''}.`.replace(/\s+\.$/, '.');
  const summary = withSummary && session.lastMessage !== null ? firstSentence(session.lastMessage) : '';
  return summary === '' ? `${title}. Finished.` : `${title}. Finished. ${summary}`;
}

const terminalHasFocus = (session: ClaudeSession) =>
  session.terminalId !== null &&
  document.activeElement?.closest(`[data-terminal-id="${session.terminalId}"]`) !== null &&
  document.activeElement !== null;

/**
 * Watches sessions for the changes of HUD-10 and HUD-13 and raises a Windows notification and a spoken
 * alert, each rate-limited per session. Called once by the HUD's `register`.
 */
export function startHudAlerts(bus: Bus, now: () => number = Date.now): void {
  const previous = new Map<string, SessionActivity>();
  const workingSince = new Map<string, number>();
  const lastNotified = new Map<string, number>();
  const lastSpoken = new Map<string, number>();

  useHudData.subscribe((state) => {
    const settings = state.settings;
    for (const session of state.sessions.values()) {
      const before = previous.get(session.sessionId);
      previous.set(session.sessionId, session.activity);
      if (session.activity === 'working' && before !== 'working') workingSince.set(session.sessionId, now());
      if (before === undefined || before === session.activity) continue;
      const worked = now() - (workingSince.get(session.sessionId) ?? now());
      const kind =
        session.activity === 'needs-you' ? 'needs-you' : session.activity === 'done' && worked >= MIN_WORK_MS ? 'done' : null;
      if (kind === null) continue;
      const time = now();
      const windowFocused = document.hasFocus();
      const wanted = kind === 'needs-you' ? settings.notifyOnNeedsYou : settings.notifyOnDone;
      if (wanted && !windowFocused && time - (lastNotified.get(session.sessionId) ?? 0) >= ALERT_GAP_MS) {
        lastNotified.set(session.sessionId, time);
        void bus.call(shellChannels.notify, {
          title: cutAtWord(session.title || 'Claude session', 80),
          body: kind === 'needs-you' ? (session.attentionReason ?? 'Needs you') : 'Finished',
          focusPanel: null,
        });
      }
      const looking = windowFocused && terminalHasFocus(session);
      if (settings.speakAlerts && !looking && time - (lastSpoken.get(session.sessionId) ?? 0) >= ALERT_GAP_MS) {
        lastSpoken.set(session.sessionId, time);
        void bus.call(shellChannels.speak, {
          text: spokenText(session, kind, settings.speakSummary).slice(0, 300),
          voice: settings.speakVoice === '' ? null : settings.speakVoice,
          rate: settings.speakRate,
        });
      }
    }
  });
}
