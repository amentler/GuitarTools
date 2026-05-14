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

- `results.jsonl`: full candidate history and resume source.
- `results.csv`: ranked candidate summary.
- `report.md`: human-readable timing/count scores plus per-strategy ranking.
- `best-001.config.json` to `best-005.config.json`: configs usable with
  `npm run sheetfingerprint -- --onset-config <file>`.
- `best-<strategy>.json` and `best-<strategy>-001.config.json`: best configs
  per onset strategy.

Scoring prefers tagged onset timing when a fixture manifest contains
`onsetsMs`: matches within 30 ms are good, 30..50 ms are acceptable, misses and
unmatched detections are penalized, and extra detections receive an additional
overfire penalty. Fixtures without tags keep the count-based fallback score.
