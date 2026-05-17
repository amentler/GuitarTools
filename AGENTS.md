# AI Agent Mandates - GuitarTools

This file is the central hub for all AI agents (Claude, Gemini, Codex, Copilot, etc.) working on this project. All project-wide mandates, workflows, and generic technical standards are defined here.

## 1. Collaboration & Documentation

- **Documentation authority:** `AGENTS.md` is the authoritative, always-current instruction file for this project and must be kept up to date after completed tasks.
- **Supplementary docs only when needed:** `CLAUDE.md`, `GEMINI.md`, `codex.md`, and plan files are complementary. Update them only when the task adds platform-specific, workflow-specific, or planning-specific information that is worth preserving there.
- **Feature-specific documentation:** If a module subfolder (e.g. `js/games/myGame/`) does not yet have a `CLAUDE.md`, create one to document its local state.
- **Automated Versioning:** Do NOT edit `version.txt` manually unless the commit intentionally owns metadata. The `pre-commit` hook (`scripts/auto-update-version.sh`) regenerates and stages it automatically if not already staged. Pure version-counter logic lives in `scripts/autoUpdateVersionCore.mjs`; keep tests focused on that module instead of shell-spawning Bash from Vitest.
- **Service-Worker Assets:** When adding or renaming local assets (JS, CSS, JSON, Icons, etc.), you MUST update the `ASSETS` list in `sw.js` to ensure proper offline caching and reloads.
- **Sequence ZIP Workflow:** Tagged sheet-music sequence fixtures may live as single ZIP files containing WAV+JSON. Test helpers, sheet fingerprints, and `sfp` must keep ZIP support intact; loose `.wav/.json` pairs are compatibility inputs, not the only accepted format.
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
   - **Sync path:** Use `npm run test:sync` for the normal sync workflow. It adds only fast golden/frozen audio regressions on top of `test:precommit`, but still excludes the slow Real-WAV suites.
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

graphify wird auf dieser Maschine ueber `uv` installiert. Das PyPI-Paket heisst `graphifyy` (zwei `y`), der Befehl ist `graphify`:

```bash
uv tool install graphifyy
```

Alternativen nur falls `uv` nicht verfuegbar ist:

```bash
pipx install graphifyy
```

```bash
pip install --user graphifyy
```

CLI integrations can then be registered as needed, for example:

```bash
graphify codex install
graphify claude install
graphify gemini install
```

Nach der CLI-Integration ruft Codex ueber `.codex/hooks.json` direkt `/home/amentler/.local/bin/graphify hook-check` vor jedem Bash-Call auf. Wenn `graphify` auf dieser Maschine fehlt oder unter einem anderen Pfad liegt, schlagen diese Hooks sichtbar fehl.

Fuer dieses Repo sind ausserdem die Git-Hooks per `graphify hook install` in `.husky/_/post-commit` und `.husky/_/post-checkout` registriert. Damit koennen Graph-Updates nach Checkout/Commit automatisch angestossen werden.

### Shortcuts
- `sfp` -> `npm run sfp` (Short for specific fingerprinting/fixtures tasks).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
