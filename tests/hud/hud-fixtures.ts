import { ClaudeSession } from '@hsos/contracts/channels/claude-link';
import type { SessionActivity, SubagentInfo } from '@hsos/contracts/channels/claude-link';

/** A valid session with every field present; a test overrides what it cares about. */
export function makeSession(overrides: Partial<Record<keyof ClaudeSession, unknown>> = {}): ClaudeSession {
  return ClaudeSession.parse({
    sessionId: 'session-1',
    terminalId: 'terminal-001',
    cwd: 'C:\\Users\\x\\code\\app',
    title: 'Fix the ribbon',
    model: 'Opus 5.5',
    modelId: 'claude-opus-5-5',
    effort: 'high',
    permissionMode: 'plan',
    activity: 'working' satisfies SessionActivity,
    attentionReason: null,
    currentTool: null,
    startedAt: 1_000,
    lastResponseAt: null,
    contextUsedPercentage: 72,
    contextTokens: 144_000,
    contextWindowSize: 200_000,
    costUsd: null,
    lastMessage: null,
    subagents: [],
    ...overrides,
  });
}

/** A subagent that is running (endedAt null) or ended at the given time. */
export function makeAgent(id: string, endedAt: number | null, startedAt = 1_000): SubagentInfo {
  return {
    agentId: id as SubagentInfo['agentId'],
    agentType: `type-${id}`,
    model: 'Haiku 4.5',
    description: `job ${id}`,
    startedAt: startedAt as SubagentInfo['startedAt'],
    endedAt: endedAt as SubagentInfo['endedAt'],
    currentTool: endedAt === null ? `Tool${id}` : null,
  };
}
