import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';

/** The open project: undefined while it loads, null when no project is open (WS-12). */
export function useProject(bus: Bus): ProjectInfo | null | undefined {
  const [project, setProject] = useState<ProjectInfo | null | undefined>(undefined);
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
  return project;
}
