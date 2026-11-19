import { z } from 'zod';
import type { PanelProps } from '@hsos/contracts/module';
import { useState } from 'react';
import { Icon, IconButton, useToast } from '@hsos/ui-kit';
import { skillsChannels } from '@hsos/contracts/channels/skills';
import { useHudDeps } from './hud-context';
import { QuickBar } from './QuickBar';
import { Section } from './Section';
import { SessionsBoard, SessionsMenu } from './SessionsSection';
import { focusSkillSearch, SkillsDeck, SkillsRepoRow } from './SkillsSection';
import { UsageBars, useUsageNote } from './UsageSection';
import styles from './Hud.module.css';

export const HudPanelState = z.object({
  /** Section ids that are collapsed, saved with the panel (hud.md "Panel"). */
  collapsed: z.array(z.enum(['sessions', 'usage', 'skills', 'repo'])),
});
export type HudPanelState = z.infer<typeof HudPanelState>;
type SectionId = HudPanelState['collapsed'][number];

export const INITIAL_HUD_STATE: HudPanelState = { collapsed: [] };

/** Asks the HUD to expand Skills and focus its search (HUD-61, `hud.searchSkills`). */
let expandSkills: () => void = () => undefined;
export function searchSkills(): void {
  expandSkills();
  requestAnimationFrame(focusSkillSearch);
}

/** The HUD side view (`hud.panel`): the quick bar, then Sessions, Usage, Skills and Skills repo. */
export function HudPanel({ state, setState }: PanelProps<HudPanelState>) {
  const deps = useHudDeps();
  const toast = useToast();
  // The frame does not save side view state yet, so the panel keeps its own copy as well.
  const [collapsed, setCollapsed] = useState<readonly SectionId[]>(state.collapsed);
  const usageNote = useUsageNote();
  const toggle = (id: SectionId) => {
    const next = collapsed.includes(id) ? collapsed.filter((entry) => entry !== id) : [...collapsed, id];
    setCollapsed(next);
    setState({ collapsed: next });
  };
  expandSkills = () => {
    if (collapsed.includes('skills')) toggle('skills');
  };
  const openSkillsFolder = async () => {
    const result = await deps.bus.call(skillsChannels.openSkillsFolder, {});
    if (!result.ok)
      toast.show({
        tone: 'error',
        message: result.error.message,
        action: { label: 'Settings', onPress: () => deps.openPanel('settings.screen') },
      });
  };
  return (
    <div className={styles.hud}>
      <QuickBar onSearchSkills={searchSkills} />
      <Section title="Sessions" collapsed={collapsed.includes('sessions')} onToggle={() => toggle('sessions')} tools={<SessionsMenu />} log={deps.log}>
        <SessionsBoard />
      </Section>
      <Section title="Usage" collapsed={collapsed.includes('usage')} onToggle={() => toggle('usage')} note={usageNote} log={deps.log}>
        <UsageBars />
      </Section>
      <Section
        title="Skills"
        collapsed={collapsed.includes('skills')}
        onToggle={() => toggle('skills')}
        tools={<IconButton icon={<Icon name="folder-open" />} label="Open skills folder" onPress={() => void openSkillsFolder()} />}
        log={deps.log}
      >
        <SkillsDeck />
      </Section>
      <Section title="Skills repo" collapsed={collapsed.includes('repo')} onToggle={() => toggle('repo')} log={deps.log}>
        <SkillsRepoRow />
      </Section>
    </div>
  );
}
