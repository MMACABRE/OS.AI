import { useEffect, useState } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { reviewChannels } from '@hsos/contracts/channels/review';
import { useRepo } from './use-repo';

/**
 * The left status item `review.tray`: "n comments" when the feedback tray holds any (REV-30).
 * It only reports the count; opening the tray needs a side-view switch the renderer cannot make yet.
 */
export function TrayCount({ bus }: { readonly bus: Bus }) {
  const { project } = useRepo(bus);
  const [count, setCount] = useState(0);
  const projectId = project?.id ?? null;

  useEffect(() => {
    if (projectId === null) return undefined;
    let live = true;
    void bus.call(reviewChannels.listComments, { projectId }).then((result) => {
      if (live && result.ok) setCount(result.value.length);
    });
    const off = bus.on(reviewChannels.commentsChanged, (payload) => {
      if (payload.projectId === projectId) setCount(payload.comments.length);
    });
    return () => {
      live = false;
      off();
    };
  }, [bus, projectId]);

  if (count === 0) return null;
  return <span>{`${count} comment${count === 1 ? '' : 's'}`}</span>;
}
