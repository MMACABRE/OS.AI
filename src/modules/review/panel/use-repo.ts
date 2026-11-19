import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';

/**
 * The open project and its repo status: undefined while loading. `status` is null when no project is open.
 * A copy of the git module's hook; the Lead should move the shared one to ui-kit or workspace.
 */
export function useRepo(bus: Bus): { readonly project: ProjectInfo | null | undefined; readonly status: RepoStatus | null | undefined } {
  const [project, setProject] = useState<ProjectInfo | null | undefined>(undefined);
  const [status, setStatus] = useState<RepoStatus | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void bus.call(workspaceChannels.getCurrentProject, {}).then((result) => {
      if (live) setProject(result.ok ? result.value : null);
    });
    const off = bus.on(workspaceChannels.projectChanged, (next) => {
      if (live) setProject(next);
    });
    return () => {
      live = false;
      off();
    };
  }, [bus]);

  const root = project?.path ?? null;
  useEffect(() => {
    if (root === null) {
      setStatus(project === null ? null : undefined);
      return undefined;
    }
    let live = true;
    void bus.call(gitChannels.getStatus, { root }).then((result) => {
      if (live) setStatus(result.ok ? result.value : null);
    });
    const off = bus.on(gitChannels.statusChanged, (next) => {
      if (live) setStatus(next);
    });
    return () => {
      live = false;
      off();
    };
  }, [bus, root, project]);

  return { project, status };
}
