# Onset Sweep Usage

Start a full autonomous sweep:

```bash
npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json
```

Start the PowerShell default sweep from the repository root with 20 workers:

```bash
./runsweep.ps1
```

Show CLI help:

```bash
npm run onsetsweep -- --help
```

Validate fixture discovery and parameter names without evaluating candidates:

```bash
npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json --dry-run
```

Resume an interrupted run:

```bash
npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json --resume sweep-runs/onset/<run-dir>
```

Run a tiny smoke test:

```bash
npm run onsetsweep -- --spec plans/sheet_music_onset_repair/onset-sweep-spec.json --max-candidates 1
```

The runner writes each run to `sweep-runs/onset/<timestamp>/`.

Important outputs:

- `results.jsonl`: compact candidate history and resume source.
- `report.md`: current best parameter values per onset strategy.
- `best-by-strategy.json` and `best-by-strategy.csv`: concise overview of the
  current best candidate for each strategy.
- `best-<strategy>.json` and `best-<strategy>.config.json`: current best
  candidate and config for one onset strategy. Use the config with
  `npm run sheetfingerprint -- --onset-config <file>`.

The runner does not write per-round JSON snapshots anymore. After each round it
prints a narrow table with `strategy`, `mode`, `stagnation`, overall best score
and round-best score, followed by the current best parameter values for each
strategy.

Scoring prefers tagged onset timing when a fixture manifest contains
`onsetsMs`: matches within 30 ms are good, 30..50 ms are acceptable, misses and
unmatched detections are penalized, and extra detections receive an additional
overfire penalty. Fixtures without tags keep the count-based fallback score.
