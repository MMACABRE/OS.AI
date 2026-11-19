import { useSyncExternalStore } from 'react';
import type { Bus } from '@hsos/contracts/bus';
import { gitChannels } from '@hsos/contracts/channels/git';
import type { RepoStatus } from '@hsos/contracts/channels/git';
import { workspaceChannels } from '@hsos/contracts/channels/workspace';
import type { ProjectInfo } from '@hsos/contracts/channels/workspace';

export type RepoSnapshot = {
  /** The open project: undefined while it loads, null when none is open. */
  readonly project: ProjectInfo | null | undefined;
  /** The repo status: undefined while it loads, null when no project is open or it could not be read. */
  readonly status: RepoStatus | null | undefined;
};

const LOADING: RepoSnapshot = { project: undefined, status: undefined };

/** One shared subscription per bus: the open project and its repo status (WS-12, GIT-11). */
class RepoStore {
  private snapshot: RepoSnapshot = LOADING;
  private readonly listeners = new Set<() => void>();
  private offs: (() => void)[] = [];
  private offStatus: (() => void) | null = null;
  private watching: string | null = null;
  private epoch = 0;

  constructor(private readonly bus: Bus) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  };

  readonly get = (): RepoSnapshot => this.snapshot;

  private set(next: RepoSnapshot): void {
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private start(): void {
    const epoch = ++this.epoch;
    void this.bus.call(workspaceChannels.getCurrentProject, {}).then((result) => {
      if (epoch === this.epoch) this.project(result.ok ? result.value : null);
    });
    this.offs.push(this.bus.on(workspaceChannels.projectChanged, (next) => this.project(next)));
  }

  private stop(): void {
    this.epoch += 1;
    for (const off of this.offs) off();
    this.offs = [];
    this.offStatus?.();
    this.offStatus = null;
    this.watching = null;
    this.snapshot = LOADING;
  }

  /** A new project: its status is read once, then follows `statusChanged`. */
  private project(project: ProjectInfo | null): void {
    const root = project?.path ?? null;
    if (root === this.watching && this.snapshot.project !== undefined) {
      this.set({ project, status: this.snapshot.status });
      return;
    }
    this.watching = root;
    this.offStatus?.();
    this.offStatus = null;
    const epoch = this.epoch;
    this.set({ project, status: project === null ? null : undefined });
    if (root === null) return;
    void this.bus.call(gitChannels.getStatus, { root }).then((result) => {
      if (epoch === this.epoch && this.watching === root)
        this.set({ project: this.snapshot.project, status: result.ok ? result.value : null });
    });
    this.offStatus = this.bus.on(gitChannels.statusChanged, (next) => {
      if (this.watching === root) this.set({ project: this.snapshot.project, status: next });
    });
  }
}

const stores = new WeakMap<Bus, RepoStore>();

/** The open project and its repo status. Every component of this module shares one subscription per bus. */
export function useRepo(bus: Bus): RepoSnapshot {
  let store = stores.get(bus);
  if (store === undefined) {
    store = new RepoStore(bus);
    stores.set(bus, store);
  }
  return useSyncExternalStore(store.subscribe, store.get);
}
