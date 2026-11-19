import type { ModuleFixtures } from '../demo-transport';
import { ago, HOME, HSOS, MIN } from './world';

type State = 'on' | 'name-only' | 'user-invocable-only' | 'off';
type Source = 'user' | 'project' | 'plugin';

const RAW: readonly [string, string, Source, State, boolean?][] = [
  ['hsluck', 'Loads the standard skill bundle in one call', 'user', 'on', true],
  ['hs24skills', 'Loads the 24 lifecycle skills', 'user', 'on', true],
  ['hsdevloop', 'Runs the pipelined development loop with a tester and a reviewer', 'user', 'on', true],
  ['hsuiux', 'Loads the UI, UX and visual design skills', 'user', 'on'],
  ['caveman', 'Ultra-compressed replies that keep the technical substance', 'user', 'on', true],
  ['unslop', 'Cuts AI tells from any writing', 'user', 'on'],
  ['ponytail', 'Forces the laziest solution that actually works', 'user', 'on'],
  ['graphify', 'Turns a folder into a navigable knowledge graph', 'user', 'name-only'],
  ['find-skills', 'Finds and installs skills from the open ecosystem', 'user', 'name-only'],
  ['impeccable', 'Designs, critiques and polishes interfaces', 'user', 'name-only'],
  ['design-taste-frontend', 'Art direction for public pages and app screens', 'user', 'name-only'],
  ['frontend-design', 'Distinctive production-grade React interfaces', 'user', 'user-invocable-only'],
  ['security-review', 'Reviews the pending changes for security problems', 'user', 'user-invocable-only'],
  ['code-review', 'Reviews the current diff for correctness bugs', 'user', 'user-invocable-only'],
  ['research', 'Investigates a question against primary sources', 'user', 'user-invocable-only'],
  ['vps-ssh', 'Runs commands on a remote server over SSH', 'user', 'off'],
  ['pricing-strategy', 'Pricing models and packaging advice', 'user', 'off'],
  ['marketing-psychology', 'Persuasion principles for product pages', 'user', 'off'],
  ['first-b2b-customers', 'Finding the first business customers', 'user', 'off'],
  ['phosphor-check', 'Checks a screen against the Phosphor visual direction', 'project', 'on', true],
  ['card-runner', 'Runs one task card through the implementer protocol', 'project', 'on'],
  ['fixture-writer', 'Writes demo fixtures that parse with their channel schemas', 'project', 'name-only'],
  ['spec-guard', 'Checks a change against the module spec rules', 'project', 'user-invocable-only'],
  ['old-site-deploy', 'Deploys the old static site', 'project', 'off'],
  ['grilling', 'Grills a plan until every branch is settled', 'plugin', 'on'],
  ['domain-modeling', 'Builds and sharpens the glossary and ADRs', 'plugin', 'on'],
  ['tdd', 'Red, green, refactor', 'plugin', 'name-only'],
  ['diagnosing-bugs', 'Diagnosis loop for hard bugs', 'plugin', 'user-invocable-only'],
  ['prototype', 'Throwaway prototypes for a design question', 'plugin', 'off'],
  ['writing-for-agents', 'Writing skills and agent instructions', 'plugin', 'off'],
];

/** 30 skills in all four states, from the owner's folder, the project and a plugin. */
export const SKILLS = RAW.map(([name, description, source, state, favourite]) => ({
  name,
  description,
  source,
  plugin: source === 'plugin' ? 'mattpocock-skills' : null,
  file:
    source === 'project'
      ? `${HSOS.path}\\.claude\\skills\\${name}\\SKILL.md`
      : source === 'plugin'
        ? `${HOME}\\.claude\\plugins\\cache\\mattpocock-skills\\${name}\\SKILL.md`
        : `${HOME}\\.agents\\skills\\${name}\\SKILL.md`,
  isFavourite: favourite === true,
  state,
  stateSource: state === 'on' ? 'default' : source === 'project' ? 'project' : 'user',
  stateLock: source === 'plugin' && state === 'on' ? 'plugin' : null,
}));

const run = (
  id: string,
  skill: string,
  state: string,
  startedAgo: number,
  endedAgo: number | null,
  report: string | null,
) => ({
  id,
  skill,
  args: '',
  model: 'haiku',
  effort: 'medium',
  cwd: HSOS.path,
  state,
  startedAt: ago(startedAgo),
  endedAt: endedAgo === null ? null : ago(endedAgo),
  report,
  failure: state === 'failed' ? 'The run stopped after 20 minutes.' : null,
  costUsd: endedAgo === null ? null : 0.04,
});

/** The `skills` channels. */
export const skillsFixtures: ModuleFixtures = {
  requests: {
    'skills.list': SKILLS,
    'skills.setFavourite': {},
    'skills.openSkillsFolder': { path: `${HOME}\\.agents\\skills` },
    'skills.setState': { file: `${HOME}\\.claude\\settings.json` },
    'skills.startRun': run('run000000004', 'phosphor-check', 'queued', 0, null, null),
    'skills.cancelRun': {},
    'skills.listRuns': [
      run('run000000001', 'phosphor-check', 'running', 2 * MIN, null, null),
      run(
        'run000000002',
        'fixture-writer',
        'succeeded',
        30 * MIN,
        24 * MIN,
        'All 16 fixture files parse with their schemas.',
      ),
      run('run000000003', 'spec-guard', 'failed', 90 * MIN, 70 * MIN, null),
    ],
    'skills.getRepoSync': {
      state: 'out-of-sync',
      changed: ['hsluck', 'caveman'],
      added: ['phosphor-check'],
      removed: [],
      ahead: 2,
      behind: 0,
      isOffline: false,
      error: null,
      checkedAt: ago(12 * MIN),
    },
    'skills.checkRepoSync': {
      state: 'out-of-sync',
      changed: ['hsluck', 'caveman'],
      added: ['phosphor-check'],
      removed: [],
      ahead: 2,
      behind: 0,
      isOffline: false,
      error: null,
      checkedAt: ago(0),
    },
    'skills.pushToRepo': {
      state: 'in-sync',
      changed: [],
      added: [],
      removed: [],
      ahead: 0,
      behind: 0,
      isOffline: false,
      error: null,
      checkedAt: ago(0),
    },
  },
};
