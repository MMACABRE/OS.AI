import { subscribe } from '@parcel/watcher';
import type { FileWatcher } from '@hsos/contracts/channels/files';

const KINDS: Readonly<Record<'create' | 'update' | 'delete', 'created' | 'changed' | 'deleted'>> = {
  create: 'created',
  update: 'changed',
  delete: 'deleted',
};

/** The real watcher behind the `FileWatcher` seam, through @parcel/watcher. Card 004. */
export function createParcelFileWatcher(): FileWatcher {
  return {
    async watch(root, exclude, onChanges) {
      const subscription = await subscribe(
        root,
        (error, events) => {
          if (error !== null) return;
          onChanges(events.map((event) => ({ path: event.path, kind: KINDS[event.type] })));
        },
        { ignore: [...exclude] },
      );
      return () => subscription.unsubscribe();
    },
  };
}
