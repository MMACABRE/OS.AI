import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createStubBus } from '../fakes/stub-bus';
import { createFakeUiContext } from '../fakes/fake-ui-context';
import { register as registerActivity } from '../../src/modules/activity/register.ui';
import { register as registerReview } from '../../src/modules/review/register.ui';

afterEach(cleanup);

describe('activity and review commands (cards 030, 033)', () => {
  it('ACT commands activity.showTimeline and activity.showArtifacts open the Activity and Artifacts side views', () => {
    const ctx = createFakeUiContext('activity', createStubBus());
    registerActivity(ctx);
    expect(ctx.commands.map((command) => command.id)).toEqual(
      expect.arrayContaining(['activity.showTimeline', 'activity.showArtifacts']),
    );
    const typeOf = (title: string) => ctx.panels.find((panel) => panel.title === title)?.type;
    ctx.command('activity.showTimeline').run();
    ctx.command('activity.showArtifacts').run();
    expect(ctx.opened.map((item) => item.type)).toEqual([typeOf('Activity'), typeOf('Artifacts')]);
  });

  it('REV command review.showChanges (Ctrl+Shift+G) opens the Changes side view', () => {
    const ctx = createFakeUiContext('review', createStubBus());
    registerReview(ctx);
    expect(ctx.command('review.showChanges').defaultKey).toBe('Ctrl+Shift+G');
    ctx.command('review.showChanges').run();
    expect(ctx.opened.map((item) => item.type)).toEqual([
      ctx.panels.find((panel) => panel.title === 'Changes')?.type,
    ]);
  });
});
