import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import { shellChannels } from '@hsos/contracts/channels/shell';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { AppError } from '@hsos/contracts/result';

/** The owner's sentence for a git error (git.md "UI"). Null when no message is shown (GIT_OFFLINE). */
export function gitMessage(error: AppError): string | null {
  switch (error.code) {
    case 'GIT_DIRTY_TREE':
      return 'Commit or discard your changes before pulling.';
    case 'GIT_CONFLICT':
      return 'Your branch and GitHub have both changed. Merge them in a terminal, then sync again.';
    case 'GIT_AUTH_REQUIRED':
      return 'GitHub needs you to sign in.';
    case 'GIT_OFFLINE':
      return null;
    case 'GIT_REFUSED_UNSAFE':
      return 'HSOS does not run commands that rewrite or discard history.';
    default:
      return error.message;
  }
}

/**
 * Runs `sync` or `fetch` on the open project (GIT-23). Commands run outside the React tree, so their
 * outcome goes to a Windows notification rather than a toast.
 */
export async function runGitCommand(bus: Bus, action: 'sync' | 'fetch'): Promise<void> {
  const project = await bus.call(workspaceChannels.getCurrentProject, {});
  if (!project.ok || project.value === null) {
    await bus.call(shellChannels.notify, { title: 'Git', body: 'Open a project first.', focusPanel: null });
    return;
  }
  const root = project.value.path;
  const result =
    action === 'sync' ? await bus.call(gitChannels.sync, { root }) : await bus.call(gitChannels.fetch, { root });
  if (result.ok) {
    if (action === 'sync')
      await bus.call(shellChannels.notify, { title: 'Git', body: 'Synced with GitHub.', focusPanel: null });
    return;
  }
  const message = gitMessage(result.error);
  if (message !== null) await bus.call(shellChannels.notify, { title: 'Git', body: message, focusPanel: null });
}
