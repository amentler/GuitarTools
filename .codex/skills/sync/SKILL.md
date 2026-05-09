---
name: sync
description: >
  GuitarTools Git-Sync: staged, schnelle Tests (ohne Audio), optional langsame Tests
  (mit Audio), commit, pull, push. Verwenden wenn der Nutzer "sync" schreibt oder
  Änderungen committen und pushen will.
---

# Sync – GuitarTools

Führt den vollständigen Sync-Workflow durch: Tests → Commit → Pull → Push.

## Entscheidungsbaum vor dem Start

1. **Was hat sich geändert?** → `git status` + `git diff --name-only HEAD`
2. **Nur Markdown?** → Tests überspringen.
3. **Nicht-Markdown-Änderungen?** → Precommit-Tests laufen lassen.
4. **Real-WAV-/Audio-Tests** nur laufen lassen, wenn der Nutzer sie explizit verlangt oder die Änderung genau diese langsamen Tests bzw. Audio-Erkennungspipeline betrifft.
5. **Commit-Message:** Aus dem Kontext der Änderungen ableiten oder den Nutzer fragen.

## Workflow

### Precommit-Tests (immer bei nicht-Markdown-Änderungen)

```bash
npm run test:precommit
```

`test:precommit` darf keine Real-WAV-Tests enthalten. Es nutzt Unit-Tests sowie schnelle
Golden-/Frozen-Fixture-Tests, die aus JSON-Goldens/Frozen-Daten laufen.

### Langsame Real-WAV-Tests (nur explizit)

```bash
npm run test:audio:slow
```

Diese Tests lesen echte WAV-Dateien aus `tests/fixtures/**` und sind nicht Teil des
normalen Precommit-/Sync-Pfads.

### Commit, Pull, Push

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --skip-tests \
  --commit-message "<message>" \
  --merge-branch main
```

`--skip-tests` wird übergeben, weil Tests im vorherigen Schritt bereits gelaufen sind.  
Bei reinen Markdown-Änderungen ebenfalls `--skip-tests` (kein Test-CMD nötig).

## Repo-Besonderheiten

- `version.txt` und `sw.js` werden vom `prepare-commit-msg`-Hook automatisch
  aktualisiert und gestaged — **nie manuell anfassen**.
- Nach dem Commit können diese Dateien bereits für den *nächsten* Commit gestaged
  sein. `git status` nach jedem Commit prüfen.
- Branch ist `main`; Merge-Schritt entfällt (current == merge-branch).

## Regeln

- Tests müssen grün sein, bevor committed wird. Bei Fehlern: stoppen und melden.
- Commit-Message auf Englisch, im Conventional-Commits-Stil (`feat:`, `fix:`, `chore:`, …).
- Nicht pushen, wenn Tests fehlgeschlagen sind.
