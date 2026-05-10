---
name: import-sequence-fixtures
description: Import new sheet-music sequence test fixtures from tests/fixtures/dropsequence or tests/fixtures/sequencedrop into tests/fixtures/sequences. Use when the user asks to import sheet tests, sequence tests, sequencedrop/dropsequence files, ZIPs containing WAV+JSON manifests, or to refresh sheet-music sequence fingerprint fixtures.
---

# Import Sequence Fixtures

## Overview

Import WAV/JSON sequence fixture pairs from the project drop folder and promote only fully recognized recordings into the sheet-music sequence positive test list.

## Workflow

1. Inspect the drop folder:

```bash
find tests/fixtures/dropsequence tests/fixtures/sequencedrop -maxdepth 3 -type f 2>/dev/null
```

2. Run the bundled importer from the repository root:

```bash
python3 .codex/skills/import-sequence-fixtures/scripts/import_sequence_fixtures.py
```

The script accepts ZIP files and direct WAV/JSON pairs. It validates manifests, validates the WAV header, writes fixtures to `tests/fixtures/sequences/<category>/`, runs the sheet sequence fingerprint for imported files, and adds passing files to `SHEET_FINGERPRINT_POSITIVE_FIXTURE_FILES`.

3. Run focused verification:

```bash
npm run sheetfingerprint
npm run test:audio -- tests/unit/sheetMusicSequenceFingerprint.test.js
```

If the importer reports no files, do not invent fixtures. Tell the user the drop folder is empty.

## Manifest Rules

Each sequence needs a `.wav` file and a same-basename `.json` manifest. ZIP subdirectories are allowed. The manifest should contain:

- `category`: lowercase target folder such as `open-strings`, `fretted-notes`, or `mixed-sequences`. If absent, the importer uses `open-strings` for compatibility with older fixtures.
- `notes`: non-empty expected note sequence with octave, for example `["E2", "A2", "D3", "G3"]`.
- Optional context fields such as `tempoBpm`, `notesPerBeat`, `description`, `source`, `expectedMode`, and `knownLimitations`.

If a recorder manifest uses `bpm`, the importer copies it to `tempoBpm` while preserving the original field.

Treat `bpm`, `tempoBpm`, and `notesPerBeat` as descriptive metadata only. Real recordings can be slower, faster, or unsteady, so do not make sheet fingerprint assertions depend on exact timing derived from those fields.

Existing fixtures are never overwritten. Exact duplicate WAV/JSON pairs are skipped; name collisions receive a stable numeric suffix.

## Options

- Use `--drop-dir <path>` when files are outside the default drop folder.
- Use `--dry-run` to validate and preview without writing files.
- Use `--no-promote` to import fixtures without updating the positive list.
- Use `--skip-sheetfingerprint` only when another verification command will run immediately after.

After importing, inspect `git diff -- tests/fixtures/sequences tests/helpers/sheetMusicSequenceFingerprint.js` before committing.
