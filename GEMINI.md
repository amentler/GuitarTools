# Gemini Mandates - GuitarTools

As an AI agent working on this project, you MUST adhere to the following rules:

## 1. Documentation & Plan Updates
- **AFTER EVERY COMPLETED TASK**, you MUST update the corresponding `.md` files (plans in `plans/`, `CLAUDE.md`, or this `GEMINI.md`).
- Ensure that the project status, next steps, and architectural changes are accurately reflected in the documentation.
- If a plan in `plans/` was implemented, mark it as completed or update it with the next iteration.
- Repository-wide initial analyses can be documented in `/codex.md`.

## 2. Technical Standards
- **Vanilla Everything:** No frameworks, no build steps. Use ES Modules.
- **SVG for UI:** Prefer SVG for interactive components (fretboard, tuner, etc.).
- **Mobile First:** The UI must be responsive and touch-friendly.
- **PWA Ready:** Keep the Service Worker (`sw.js`) and manifest updated if new assets are added.

## 3. Workflow
- **Research -> Strategy -> Execution -> Validation**
- Always verify changes with tests or by checking the app's functionality in the browser context if possible.
- Update `CLAUDE.md` and `GEMINI.md` to reflect any new components or structure.
