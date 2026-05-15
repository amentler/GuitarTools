# AI Agent Mandates - GuitarTools

This file is the central hub for all AI agents (Claude, Gemini, Codex, Copilot, etc.) working on this project. All project-wide mandates, workflows, and generic technical standards are defined here.

## 1. Collaboration & Documentation

- **Update .md files:** AFTER EVERY COMPLETED TASK, you MUST update all relevant `.md` files (plans in `plans/`, `CLAUDE.md`, `GEMINI.md`, or `codex.md`).
- **Feature-specific documentation:** If a module subfolder (e.g. `js/games/myGame/`) does not yet have a `CLAUDE.md`, create one to document its local state.
- **Automated Versioning:** Do NOT edit `version.txt` manually unless the commit intentionally owns metadata. The `pre-commit` hook (`scripts/auto-update-version.sh`) regenerates and stages it automatically if not already staged.
- **Service-Worker Assets:** When adding or renaming local assets (JS, CSS, JSON, Icons, etc.), you MUST update the `ASSETS` list in `sw.js` to ensure proper offline caching and reloads.
- **Keep Plans Current:** Update implementation status in `plans/` files immediately after execution. Store new ideas in `plans/ideen.md`.

## 2. Technical Standards & Architecture

- **Vanilla Everything:** No frameworks, no build steps. Use ES Modules.
- **Web Components:** Use `js/components/` for reusable UI elements. Register via `js/components/index.js`.
- **SVG for UI:** Prefer SVG for interactive components (fretboard, tuner, etc.).
- **Mobile First:** Ensure the UI is responsive and touch-friendly.
- **PWA Ready:** Keep `sw.js` and `manifest.json` updated.
- **Logic Isolation:** Business logic belongs in `*Logic.js` files as pure functions.
- **Architecture Reference:** Follow [docs/architecture.md](docs/architecture.md).

## 3. Workflow & Quality Assurance

### Standard Workflow
1. **Research:** Map codebase, validate assumptions, reproduce bugs.
2. **Strategy:** Formulate a grounded plan.
3. **Execution:** Apply surgical changes (Plan -> Act -> Validate).
4. **Validation:** Run tests and check functionality.

### Pre-Commit Mandate
BEFORE committing any changes, you MUST:
1. Run `npm run lint` (ESLint). Fix all errors.
2. Run `npm run test:precommit` (Fast unit tests). All tests must pass.
   - **Scope:** `fretboardLogic`, `tunerLogic`, `tonFinderLogic`, `akkordLogic`, `sheetMusicLogic`, `metronomeLogic`, `notePlayingLogic`, `appNavigationHistory`, `exerciseHeader`.
   - **Note:** Use `npm test` for a full run (includes slow audio tests) if you modified audio detection logic.
3. Run `graphify update .` to keep the knowledge graph current.
4. Verify `version.txt` and `sw.js` (handled by hook, but ensure no conflicts).

**Note:** Full test suite may take minutes. Use `npx vitest run <file>` for quick iterations.

## 4. Developer Guides

### Adding a New Game/Exercise
1. Create `js/games/myGame/` with `myGame.js` exporting `createMyGameExercise()`.
2. Create `pages/exercises/my-game.html`.
3. Link `style.css`, include `<gt-exercise-header>`, import components, initialize game.
4. Add `<gt-menu-card>` to `index.html`.
5. Create a local `CLAUDE.md` in the game folder.

## 5. Tools & Shortcuts

### Graphify (Knowledge Graph)
- Read `graphify-out/GRAPH_REPORT.md` for architecture insights.
- Navigate via `graphify-out/wiki/index.md` if available.
- Use `graphify query`, `graphify path`, or `graphify explain` for complex relations.
- After code changes, run `graphify update .`.

#### System Setup (einmalig pro Maschine)

graphify ist über pipx installiert. Das PyPI-Paket heißt `graphifyy` (zwei `y`), der Befehl ist `graphify`:

```bash
pipx install graphifyy
```

Falls `pipx` nicht verfügbar ist:
```bash
pip install --user graphifyy
```

Der PreToolUse-Hook in `.codex/hooks.json` ruft `graphify hook-check` vor jedem Bash-Call auf. Er ist so abgesichert, dass er bei fehlendem graphify nicht blockiert (`command -v graphify >/dev/null 2>&1 && graphify hook-check; exit 0`). graphify sollte trotzdem installiert sein, damit der Graph aktuell bleibt.

### Shortcuts
- `sfp` -> `npm run sfp` (Short for specific fingerprinting/fixtures tasks).
