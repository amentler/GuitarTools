---
description: GuitarTools Git-Sync: schnelle Tests (ohne Audio), optional langsame Tests (mit Audio), commit, pull, push. Verwenden wenn der Nutzer "sync" schreibt oder Änderungen committen und pushen will.
---

## Entscheidungsbaum vor dem Start

1. **Was hat sich geändert?** → `git status` + `git diff --name-only HEAD`
2. **Nur Markdown?** → Tests überspringen.
3. **Nicht-Markdown-Änderungen?** → Schnelle Tests laufen lassen.
4. **Audio-Fixtures geändert** (`tests/fixtures/**`) **oder Nutzer hat explizit nach Audio-Tests gefragt?** → Langsame Tests ebenfalls laufen lassen.
5. **Commit-Message:** Aus dem Kontext der Änderungen ableiten oder den Nutzer fragen.

## Workflow

### Schnelle Tests (immer bei nicht-Markdown-Änderungen)

```bash
npm run test:unit
```

### Langsame Tests (nur wenn Audio-Fixtures betroffen oder explizit gewünscht)

```bash
npm run test:audio
```

### Commit, Pull, Push

```bash
~/.codex/skills/sync/scripts/git-sync.sh \
  --skip-tests \
  --commit-message "<message>" \
  --merge-branch main
```

`--skip-tests` wird übergeben, weil Tests im vorherigen Schritt bereits gelaufen sind.
Bei reinen Markdown-Änderungen ebenfalls `--skip-tests`.

## Repo-Besonderheiten

- `version.txt` und `sw.js` werden vom `prepare-commit-msg`-Hook automatisch aktualisiert und gestaged — **nie manuell anfassen**.
- Nach dem Commit können diese Dateien bereits für den *nächsten* Commit gestaged sein. `git status` nach jedem Commit prüfen.
- Branch ist `main`; Merge-Schritt entfällt (current == merge-branch).

## Regeln

- Tests müssen grün sein, bevor committed wird. Bei Fehlern: stoppen und melden.
- Commit-Message auf Englisch, im Conventional-Commits-Stil (`feat:`, `fix:`, `chore:`, …).
- Nicht pushen, wenn Tests fehlgeschlagen sind.
