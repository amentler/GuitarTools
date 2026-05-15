# GuitarTools – Guitar Learning App

A static web app for learning guitar, running directly on GitHub Pages without a build step.

> **Operational Mandates:** All AI agents MUST follow the rules in [AGENTS.md](AGENTS.md).

## Technology

- **Vanilla HTML + CSS + JavaScript** (ES Modules, no framework)
- **SVG** for fretboard rendering
- **Web Components** for reusable UI elements
- **Dark theme** via CSS Custom Properties

## Project Structure

```
index.html          – Main menu / landing page
style.css           – Global styles and CSS Custom Properties
version.txt         – Version text shown on the main menu; auto-generated
pages/
├── ton-finder/index.html
├── fretboard-tone-recognition/index.html
├── akkord-trainer/index.html
├── akkord-uebersicht/index.html
├── akkordfolgen-trainer/index.html
├── chord-playing-essentia/index.html
├── sheet-music-reading/index.html
├── note-playing/index.html
├── guitar-tuner/index.html
├── metronome/index.html
├── audio-analyse/index.html
├── onset-tagger/index.html
├── chord-recorder/index.html
└── recordings/index.html
js/
├── app.js          – Main menu controller; imports components/index.js
├── data/           – Shared data (Single Source of Truth)
│   └── akkordData.js – All 35 chord definitions (4 categories) with finger data
├── domain/         – Domain logic (chord catalog, fretboard mapping, chord detection)
├── components/     – Reusable Web Components (UI layer)
│   ├── index.js    – Registers all custom elements
│   └── fretboard/
│       ├── gt-fretboard.js         – <gt-fretboard> Web Component
│       └── gt-fretboard-render.js  – Pure SVG render function
├── games/          – Self-contained interactive games/exercises
├── tools/          – Standalone tools
├── shared/         – Cross-module shared code (audio, music, storage, debug, pwa)
└── utils/          – Small helpers (settings.js, chordDetectionUtils.js)
```

## Architecture

The app has four layers:

1. **Navigation**: Standard HTML links between `index.html` and `pages/[feature]/index.html`.
2. **Games/Tools** (`js/games/*`, `js/tools/*`): State + flow control.
3. **UI Components** (`js/components/*`): Reusable Web Components.
4. **Logic** (`*Logic.js`): Pure functions; fully unit-tested (100% coverage goal).

Detailed architecture rules are in [docs/architecture.md](docs/architecture.md).

## `<gt-fretboard>` Web Component

The primary reusable UI component.

### Public API

- `frets` (attr/prop) — `number` — Highest fret to display (default: `5`)
- `interactive` (attr/prop) — `boolean` — If present, positions are clickable
- `positions` (prop) — `Array<{ stringIndex, fret, state }>`
- `activeStrings` (prop) — `number[]` — Default: all 6 strings

**Events:**
- `fret-select` — `detail`: `{ stringIndex, fret, note }`

### Phase rollout

| Phase | Feature migrated |
|-------|-----------------|
| ✅ Phase 1 | `tonFinder` |
| ✅ Phase 2 | `chordExerciseEssentia` |
| ✅ Phase 3 | `fretboardToneRecognition` |
| ✅ Phase 4 | Shared controls extraction & Fretboard Unification |
| ✅ Phase 5 | Sharpening Conventions |

## Runtime Settings

- **Frets:** 0–12 (default: 4)
- **Strings:** Toggle buttons E2–E4
- **Attempts:** 3 chances per note
- **Notation:** Staff notation follows guitar convention (written +1 octave)

## Knowledge Graph (graphify)

This project has a graphify knowledge graph at `graphify-out/`. See `AGENTS.md` for the full usage guide.

- **`graphify-out/GRAPH_REPORT.md`** — entry point: god nodes, community structure, graph freshness
- **Freshness check:** `graphify update .` after code changes (AST-only, no API cost)
- For architecture and "how does X relate to Y" questions, prefer graphify over grep.

## CI & Testing

- **Run unit tests:** `npm run test:precommit` (Fast) or `npm test` (Full)
- **Run E2E tests:** `npm run test:e2e` (Playwright)
- **Run linter:** `npm run lint` (ESLint)
- **Test files:** `tests/unit/`, `tests/e2e/`

### Tuner Fixture Tests

Two approaches in `tests/unit/tunerAudio.test.js`:
1. **Guitar Recordings:** Real WAVs in `tests/fixtures/audio/{Note}/`.
2. **Synthetic Sines:** Chromatic E2–C5 in `tests/fixtures/synth/`.

## Current Modules

**Games (7):** `tonFinder`, `fretboardToneRecognition`, `akkordTrainer`, `akkordfolgenTrainer`, `chordExerciseEssentia`, `sheetMusicReading`, `notePlayingExercise`

**Tools (7):** `guitarTuner`, `metronome`, `audioAnalyse`, `onsetTagger`, `chordRecorder`, `recordingsOverview`, `akkordUebersicht`

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
