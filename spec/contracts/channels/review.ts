/** Channels owned by the `review` module. Spec: spec/modules/review.md */
import { z } from 'zod';
import { event, request } from '../bus';
import { zAbsPath, zClaudeSessionId, zCommentId, zEmpty, zEpochMs, zProjectId, zRelPath } from '../schemas';

/** What a diff is measured against. */
export const ReviewBase = z.discriminatedUnion('kind', [
  /** The last commit. Needs a git repo. */
  z.object({ kind: z.literal('last-commit') }),
  /** The state of each file before a Claude session first edited it. Needs local history. */
  z.object({ kind: z.literal('session-start'), sessionId: zClaudeSessionId }),
]);
export type ReviewBase = z.infer<typeof ReviewBase>;

export const ReviewFile = z.object({
  path: zAbsPath,
  relPath: zRelPath,
  change: z.enum(['added', 'modified', 'deleted', 'renamed', 'conflicted']),
  linesAdded: z.number().int().nullable(),
  linesRemoved: z.number().int().nullable(),
  isBinary: z.boolean(),
});
export type ReviewFile = z.infer<typeof ReviewFile>;

/** What a pinned comment is attached to. */
export const CommentTarget = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('diff-line'),
    path: zAbsPath,
    /** Line number in the new version of the file, or in the old version when `side` is `before`. */
    line: z.number().int().positive(),
    side: z.enum(['before', 'after']),
    /** The text of that line, cut to 300 characters. */
    quote: z.string().max(300),
  }),
  z.object({
    kind: z.literal('file-line'),
    path: zAbsPath,
    line: z.number().int().positive(),
    quote: z.string().max(300),
  }),
  z.object({ kind: z.literal('artifact'), path: zAbsPath }),
  z.object({
    kind: z.literal('element'),
    url: z.string().max(2000),
    /** A CSS selector that finds the element. */
    selector: z.string().max(500),
    /** The element's outer HTML, cut to 4 000 characters. */
    html: z.string().max(4000),
    /** Chosen computed styles as `property: value` lines, cut to 2 000 characters. */
    styles: z.string().max(2000),
  }),
]);
export type CommentTarget = z.infer<typeof CommentTarget>;

export const PinnedComment = z.object({
  id: zCommentId,
  target: CommentTarget,
  text: z.string().min(1).max(4000),
  createdAt: zEpochMs,
});
export type PinnedComment = z.infer<typeof PinnedComment>;

const zProject = z.object({ projectId: zProjectId });

export const reviewChannels = {
  /** Files that differ from the base, sorted by relative path. */
  listChanges: request(
    'review.listChanges',
    'workspace-service',
    z.object({ projectId: zProjectId, base: ReviewBase }),
    z.array(ReviewFile),
    30_000,
  ),
  /** Both sides of one file. A side is null when the file does not exist on it. */
  getDiff: request(
    'review.getDiff',
    'workspace-service',
    z.object({ projectId: zProjectId, base: ReviewBase, path: zAbsPath }),
    z.object({ before: z.string().nullable(), after: z.string().nullable(), isBinary: z.boolean() }),
    30_000,
  ),
  /** The set of changed files may have changed. Consumers call listChanges again. */
  changesInvalidated: event('review.changesInvalidated', 'workspace-service', zProject),

  listComments: request('review.listComments', 'workspace-service', zProject, z.array(PinnedComment)),
  addComment: request(
    'review.addComment',
    'workspace-service',
    z.object({ projectId: zProjectId, target: CommentTarget, text: z.string().min(1).max(4000) }),
    PinnedComment,
  ),
  updateComment: request(
    'review.updateComment',
    'workspace-service',
    z.object({ projectId: zProjectId, id: zCommentId, text: z.string().min(1).max(4000) }),
    PinnedComment,
  ),
  removeComment: request(
    'review.removeComment',
    'workspace-service',
    z.object({ projectId: zProjectId, id: zCommentId }),
    zEmpty,
  ),
  clearComments: request('review.clearComments', 'workspace-service', zProject, zEmpty),
  commentsChanged: event(
    'review.commentsChanged',
    'workspace-service',
    z.object({ projectId: zProjectId, comments: z.array(PinnedComment) }),
  ),

  /** The text the feedback tray sends to a terminal (REV-31). */
  composePrompt: request('review.composePrompt', 'workspace-service', zProject, z.string()),
} as const;
