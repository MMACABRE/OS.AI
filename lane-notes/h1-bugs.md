# Lane H1 bugs found but not fixed

## HUD-37 "For this project only" saves the current state, not the chosen one
- Rule: hud.md HUD-37 (test row expects setState({ name, state: 'user-invocable-only', scope: 'project-local' }) for choosing "You only" then "For this project only").
- Src: src/modules/hud/panel/SkillsSection.tsx menuFor, the item label 'For this project only' calls setState(skill, skill.state, 'project-local') instead of the chosen state.
- Not tested yet; no failing test file written (not in the bug list). Lead to decide.
