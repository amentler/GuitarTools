# AI Agent Mandates - GuitarTools

This file is the central hub for all AI agents (Claude, Gemini, Codex, Copilot, etc.) working on this project. All project-wide mandates, workflows, and generic technical standards are defined here.

## 1. Collaboration & Documentation

- **Documentation authority:** `AGENTS.md` is the authoritative, always-current instruction file for this project and must be kept up to date after completed tasks.
- **Supplementary docs only when needed:** `CLAUDE.md`, `GEMINI.md`, `codex.md`, and plan files are complementary. Update them only when the task adds platform-specific, workflow-specific, or planning-specific information that is worth preserving there.
- **Feature-specific documentation:** If a module subfolder (e.g. `js/games/myGame/`) does not yet have a `CLAUDE.md`, create one to document its local state.
- **Automated Versioning:** Do NOT edit `version.txt` manually unless the commit intentionally owns metadata. The `pre-commit` hook (`scripts/auto-update-version.sh`) regenerates and stages it automatically if not already staged. Pure version-counter logic lives in `scripts/autoUpdateVersionCore.mjs`; keep tests focused on that module instead of shell-spawning Bash from Vitest.
- **Service-Worker Assets:** When adding or renaming local assets (JS, CSS, JSON, Icons, etc.), you MUST update the `ASSETS` list in `sw.js` to ensure proper offline caching and reloads.
- **Onset Tagger Persistence:** The onset tagger writes edited sidecar data and renamed baseNames directly back to the recording source when possible; local analyzer handoffs are stored as complete sheet-music takes so Audio Analyse can read WAV + sidecar via `source`/`id`.
- **Audio Analyse Training Exports:** Temporär erzeugte training-data JSONs keep the loaded recording baseName as `training_data_<baseName>.json`; do not append an additional random suffix because tagged ZIP baseNames are already unique and must stay easy to match.
- **Sequence ZIP Workflow:** Tagged sheet-music sequence fixtures may live as single ZIP files containing WAV+JSON. Test helpers, sheet fingerprints, and `sfp` must keep ZIP support intact; loose `.wav/.json` pairs are compatibility inputs, not the only accepted format.
- **Sheet-Music Reading Keys:** The Notenlesen exercise offers a major-key selector above the fret-range controls. Default is C-Dur; generated notes must stay inside the selected major key and use the current fret/string filters when they leave playable notes.
- **XGBoost Onset Assets:** The default sheet-music onset strategy is the offline browser XGBoost detector (`xgboost-android-firefox`). Keep `models/onset_detector_android_firefox.{onnx,schema.json,metrics.json}` and the local ONNX Runtime files under `js/lib/onnxruntime/` cached via `js/shared/pwa/precacheManifest.js`/`sw.js`.
- **Keep Plans Current:** Update implementation status in `plans/` files immediately after execution. Store new ideas in `plans/ideen.md`.

## 2. Technical Standards & Architecture

- **Vanilla Everything:** No frameworks, no build steps. Use ES Modules.
- **Web Components:** Use `js/components/` for reusable UI elements. Register via `js/components/index.js`.
- **SVG for UI:** Prefer SVG for interactive components (fretboard, tuner, etc.).
- **Mobile First:** Ensure the UI is responsive and touch-friendly.
- **PWA Ready:** Keep `sw.js` and `manifest.json` updated.
- **Logic Isolation:** Business logic belongs in `*Logic.js` files as pure functions.
- **File Size Limit:** Controller/Tool files (`js/games/*/`, `js/tools/*/`) must stay under **~400 LOC**. If a controller exceeds this, extract audio, UI rendering, or domain logic into separate focused modules. Pure-function logic files (`*Logic.js`) have no hard limit.
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

Nach der CLI-Integration ruft Codex ueber `.codex/hooks.json` direkt `/usr/local/bin/graphify hook-check` vor jedem Bash-Call auf. In diesem Container ist `graphify` als Symlink unter `/usr/local/bin/graphify` → `/opt/uv-tools/graphifyy/bin/graphify` installiert. Wenn `graphify` auf einer anderen Maschine fehlt oder unter einem anderen Pfad liegt, schlagen diese Hooks sichtbar fehl (z. B. `/home/<user>/.local/bin/graphify` bei lokaler uv-Tool-Installation).

Fuer dieses Repo sind ausserdem die Git-Hooks per `graphify hook install` in `.husky/_/post-commit` und `.husky/_/post-checkout` registriert. Damit koennen Graph-Updates nach Checkout/Commit automatisch angestossen werden.

#### Playwright Version

Required: **Playwright 1.59.1** (`@playwright/test` in package.json devDependencies). Do not upgrade without verifying all E2E tests still pass — matcher APIs differ between minor versions (`toHaveCountGreaterThan` does not exist in 1.x). Playwright browsers are cached in `~/.cache/ms-playwright/` and must be installed once via `npx playwright install`.

#### Playwright / Chromium System Dependencies

Playwrights Chromium braucht auf Ubuntu mindestens die Systembibliotheken
`libnspr4.so`, `libnss3.so` und `libasound.so.2`. Wenn E2E-Tests mit
`error while loading shared libraries: libnspr4.so`, `libnss3.so` oder
`libasound.so.2` abbrechen, installiere sie einmalig mit:

```bash
sudo apt-get update && sudo apt-get install -y libnspr4 libnss3 libasound2t64
```

### Shortcuts
- `sfp` -> `npm run sfp` (Short for specific fingerprinting/fixtures tasks). `sfp` vergleicht bei den Sequence-Onset-Statistiken alle verfuegbaren trainierten XGBoost-Onset-Modelle aus `models/strategies/registry.json` plus den deduplizierten Production-Default. Die Tabelle enthaelt u. a. TP/FP/FN, Precision, Recall, F1, Treffer und p95-Timing; direkt vor dem Pitch-/Note-Fingerprint folgt zusaetzlich eine kompakte Bullet-Summary je Onset-Strategie/Modell ohne Per-Datei-Details. Performance: ONNX laeuft pro Datei als Batch-Inferenz; `SFP_WORKERS=<n>` steuert die Workerzahl, `SFP_ONSET_SHARDS=<n>` kann Onset-Modelltests zusaetzlich pro Modell in Fixture-Shards zerlegen, ist aber wegen mehr ONNX-Sessions nicht immer schneller.
- Android-Firefox-XGBoost-Onset-Training: Trainingsdaten werden nicht dauerhaft als JSON gepflegt. Start im Repo-Root mit `./train_android_firefox.sh`; das Skript generiert per Node/JS aus getaggten ZIP/WAV-Quellen unter `tests/fixtures/sequences/sheet-music-reading/` temporaere `training_data_*.json` in `/tmp` und nutzt dafuer denselben JS-Feature-Pfad wie der Browser. Die JSON-Erzeugung laeuft parallel; `TRAINING_DATA_JOBS=...` steuert die Anzahl der JS-Worker (`auto` ist Default). Danach trainiert Python nur noch XGBoost auf diesen temporaeren JSONs. `TRAINING_MEDIA_DIR=...` kann eine andere getaggte Medienquelle setzen. Das Skript installiert fehlende Python-Trainingsdependencies automatisch in die ausgewaehlte Python-Umgebung und schreibt Kandidaten nach `models/onset_detector_android_firefox_candidate.*`. Die temporaere Config entsteht aus `ml/training_config.yaml` plus dem Pfad-Template `ml/training_config.android_firefox.paths.template.yaml`. Am Ende zeigt das Skript die wichtigsten Metriken kompakt in der Konsole und fragt, ob der Kandidat in `models/onset_detector_android_firefox.*` uebernommen werden soll. Die Threshold-Auswahl zielt auf Recall `0.92` und min_precision `0.45`, wobei Recall beim Ranking hoeher priorisiert bleibt (beta=3.0). Das Hyperparameter-Tuning prueft u. a. `max_depth`, `scale_pos_weight_multiplier`, `max_delta_step`, `negative_sampling_ratio` und `lookahead_frames`; Sampling und Normalisierung werden pro Kandidat neu aufgebaut. Die Uebernahme kann auch manuell mit `./apply_android_firefox_onset_detector.sh` gestartet werden. Die Basis-Config fordert CUDA/GPU-Training an und faellt automatisch auf CPU zurueck, wenn die WSL-/Container-GPU nicht verfuegbar ist.
- Android-Firefox-Trainingsdaten-Review: `npm run review:android-firefox` erzeugt `js/data/android-firefox-training-review-catalog.json` aus tagged ZIP/WAV-Fixtures und den aktuellen Android-Firefox-Metrics; dauerhaft gepflegte Trainings-JSONs sind dafuer nicht mehr noetig. Die Aufnahmen-Seite zeigt diesen Katalog als sortierbare Review-Tabelle; `training-data`-Eintraege werden im Onset Tagger read-only aus ZIP/WAV+JSON geladen und beim Speichern als lokale Sheet-Music-Takes abgelegt. `./apply_android_firefox_onset_detector.sh` aktualisiert den Review-Katalog nach der Uebernahme eines Kandidaten automatisch.

## 6. Container Dependencies

This section documents all dependencies required for the development container.

### JavaScript / Node.js (package.json devDependencies)

| Package | Version | Purpose |
|---|---|---|
| `@emnapi/core`, `@emnapi/runtime` | ^1.10.0 | ONNX Runtime (WebAssembly, for ONNX tests) |
| `@eslint/js`, `eslint` | ^10.x | Linting |
| `@playwright/test` | ^1.59.1 | E2E Tests (browsers cached in `~/.cache/ms-playwright/`) |
| `globals` | ^17.x | ESLint globals |
| `husky` | ^9.x | Git hooks |
| `jsdom` | ^29.x | DOM simulation for unit tests |
| `lint-staged` | ^16.x | Pre-commit linting |
| `rolldown` | ^1.0.0-rc | Bundler (not used in production, available for scripts) |
| `vitest` | ^4.x | Unit testing |

**Note:** `librosa` is **not** a project dependency. There is no librosa usage anywhere in the codebase.

### Python (ML Training – `.venv/`)

The `.venv/` virtual environment is used by `./train_android_firefox.sh`. Missing packages are auto-installed by the script, but the venv must exist first (`python3 -m venv .venv`).

| Package | Version constraint | Purpose |
|---|---|---|
| `numpy` | latest | Feature arrays |
| `pyyaml` | latest | Config parsing |
| `xgboost` | `<3` (currently 2.1.4) | Training (GPU-compiled, see CUDA note below) |
| `scikit-learn` | latest | ML utilities |
| `onnxmltools` | latest | ONNX export |
| `onnx` | latest | ONNX runtime |
| `packaging` | latest | Version comparisons |

### System Packages (Ubuntu 24.04)

- **Build tools:** `build-essential`, `gcc`, `g++`, `make`
- **Runtime:** `nodejs` (24.x via NodeSource), `python3.12`, `python3-pip`, `python3-venv`
- **VCS:** `git`
- **Playwright / Chromium deps:** `libnspr4`, `libnss3`, `libasound2t64`, `mesa-vulkan-drivers`
- **Container management:** `tmux`, `openssh-server`
- **Keychain / DBus:** `gnome-keyring`, `dbus`, `dbus-x11`
- **Utilities:** `curl`, `rsync`, `sudo`, `unzip`

### Global npm Packages

- `@github/copilot` – GitHub Copilot CLI agent
- `@anthropic-ai/claude-code` – Claude Code CLI
- `@google/gemini-cli` – Gemini CLI
- `@openai/codex` – OpenAI Codex CLI
- `http-server` – Local static file server

### Graphify

Installed via `uv` into `/opt/uv-tools/`, symlinked to `/usr/local/bin/graphify`:

```
/usr/local/bin/graphify → /opt/uv-tools/graphifyy/bin/graphify
```

To install on a new machine: `uv tool install graphifyy` (installs to `~/.local/bin/` by default) then run `graphify codex install` / `graphify claude install` etc.

### CUDA / GPU Status

**Current status: CPU fallback (CUDA not available at runtime)**

XGBoost 2.1.4 in `.venv/` is **compiled with CUDA 12.8** (`build_info()` confirms `USE_CUDA: True`, `CUDA_VERSION: [12, 8]`). However, GPU training does not work because:

1. No NVIDIA driver is present in this container (`/dev/nvidia*` not found, `nvidia-smi` not available).
2. The container was started without `--gpus all` / NVIDIA Container Runtime.
3. The CUDA runtime libraries are not mounted from the host.

Training **still works via CPU fallback** (`fallback_to_cpu: true` in `ml/training_config.yaml`).

**To enable GPU training**, the host machine must have:
- An NVIDIA GPU with drivers installed
- [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) (`nvidia-container-toolkit`)
- The container started with: `docker run --gpus all ...` (or `deploy.resources.reservations.devices` in docker-compose)

No code changes are needed — the config already requests CUDA and falls back automatically.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
