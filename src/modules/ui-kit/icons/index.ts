import { files } from './files.svg';
import { changes } from './changes.svg';
import { graph } from './graph.svg';
import { activity } from './activity.svg';
import { artifacts } from './artifacts.svg';
import { hud } from './hud.svg';
import { terminal } from './terminal.svg';
import { browser } from './browser.svg';
import { settings } from './settings.svg';
import { search } from './search.svg';
import { close } from './close.svg';
import { add } from './add.svg';
import { splitRight } from './split-right.svg';
import { splitDown } from './split-down.svg';
import { maximize } from './maximize.svg';
import { chevronRight } from './chevron-right.svg';
import { chevronDown } from './chevron-down.svg';
import { folder } from './folder.svg';
import { folderOpen } from './folder-open.svg';
import { file } from './file.svg';
import { fileCode } from './file-code.svg';
import { fileMarkdown } from './file-markdown.svg';
import { fileImage } from './file-image.svg';
import { gitBranch } from './git-branch.svg';
import { arrowUp } from './arrow-up.svg';
import { arrowDown } from './arrow-down.svg';
import { sync } from './sync.svg';
import { check } from './check.svg';
import { warning } from './warning.svg';
import { error } from './error.svg';
import { info } from './info.svg';
import { play } from './play.svg';
import { stop } from './stop.svg';
import { star } from './star.svg';
import { starFilled } from './star-filled.svg';
import { pin } from './pin.svg';
import { comment } from './comment.svg';
import { send } from './send.svg';
import { history } from './history.svg';
import { restore } from './restore.svg';
import { trash } from './trash.svg';
import { external } from './external.svg';
import { copy } from './copy.svg';
import { agent } from './agent.svg';
import { subagent } from './subagent.svg';
import { clock } from './clock.svg';
import { target } from './target.svg';
import { refresh } from './refresh.svg';
import { more } from './more.svg';
import type { PixelGrid } from './pixel-grid';

/** Every icon by name (ui-kit.md "Icons"). */
export const ICONS = {
  files: files,
  changes: changes,
  graph: graph,
  activity: activity,
  artifacts: artifacts,
  hud: hud,
  terminal: terminal,
  browser: browser,
  settings: settings,
  search: search,
  close: close,
  add: add,
  'split-right': splitRight,
  'split-down': splitDown,
  maximize: maximize,
  'chevron-right': chevronRight,
  'chevron-down': chevronDown,
  folder: folder,
  'folder-open': folderOpen,
  file: file,
  'file-code': fileCode,
  'file-markdown': fileMarkdown,
  'file-image': fileImage,
  'git-branch': gitBranch,
  'arrow-up': arrowUp,
  'arrow-down': arrowDown,
  sync: sync,
  check: check,
  warning: warning,
  error: error,
  info: info,
  play: play,
  stop: stop,
  star: star,
  'star-filled': starFilled,
  pin: pin,
  comment: comment,
  send: send,
  history: history,
  restore: restore,
  trash: trash,
  external: external,
  copy: copy,
  agent: agent,
  subagent: subagent,
  clock: clock,
  target: target,
  refresh: refresh,
  more: more,
} as const satisfies Record<string, PixelGrid>;

export type IconName = keyof typeof ICONS;
