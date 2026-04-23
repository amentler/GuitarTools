---
name: wav-fixture-cleanup
description: Clean and normalize WAV audio fixtures for recognition tests. Use when Codex needs to prepare, trim, downmix, normalize, inspect, or regenerate guitar/chord/note WAV fixture files, especially before updating audio goldens or tests.
---

# WAV Fixture Cleanup

## Workflow

Use this skill for repository test fixtures, not for production mastering. Keep processing deterministic and conservative so test changes remain reviewable.

1. Inspect the target files first.
   - Confirm WAV format, sample rate, channel count, bit depth, duration, peak, leading trim estimate, and trailing silence.
   - Prefer mono fixture output. If the source is stereo or multi-channel, use one source channel, normally channel 1/left, instead of averaging channels. Averaging can introduce phase cancellation and change recognition features. Use another channel only after inspecting the recording and documenting why.
   - For GuitarTools chord fixtures, keep files under `tests/fixtures/chords/<ChordName>/`.

2. Clean only the fixture files in scope.
   - Trim leading silence/noise up to the detected onset. For recognition snapshots that sample the file center, keep enough pre-roll that the center still lands near the stable chord body.
   - For GuitarTools chord fixtures, a practical starting point is `--pre-roll-ms 350 --max-content-ms 1300 --tail-silence-ms 400 --no-normalize`.
   - Do not keep very long chord tails when the extractor samples the file center; long decays can shift analysis into weak overtones. Add 300-500 ms trailing silence so extractors have a stable end buffer.
   - Add a short 5-10 ms fade-in after trimming to avoid clicks.
   - Normalize peak level only when the recognition pipeline has been re-verified with normalized audio. For GuitarTools HPCP fixtures, prefer preserving the original level because peak-picking thresholds can change when amplitude changes.
   - Preserve the original sample rate. Prefer PCM 16-bit mono output for simple fixtures unless the existing suite requires another format.

3. Recompute dependent artifacts.
   - If tests use frozen audio features or HPCP/chroma snapshots, regenerate those goldens after cleaning.
   - Run focused fixture tests first, then the broader test suite when fixture catalogs or goldens changed.
   - If a cleaned fixture still fails recognition, document the current matcher result instead of weakening thresholds broadly.

## Script

Use the bundled script when deterministic batch cleanup is needed:

```bash
node .codex/skills/wav-fixture-cleanup/scripts/clean-wav-fixtures.mjs \
  --write \
  --pre-roll-ms 350 \
  --max-content-ms 1300 \
  --no-normalize \
  tests/fixtures/chords/A7/01.wav \
  tests/fixtures/chords/E7/01.wav
```

Useful options:

- `--write`: overwrite files in place. Without it, the script only reports planned changes.
- `--pre-roll-ms 350`: keep this much audio before the detected onset.
- `--max-content-ms 1300`: keep at most this much non-silence/content after the cleaned start before adding tail silence.
- `--tail-silence-ms 400`: append this much trailing silence.
- `--fade-ms 10`: fade in the cleaned start.
- `--channel 1`: choose the 1-based source channel used for mono output.
- `--normalize --target-peak-dbfs -1`: normalize output peak after verifying that recognition still behaves correctly.
- `--no-normalize`: preserve level explicitly; this is the recommended default for GuitarTools HPCP/chord fixtures.

After running the script, inspect the printed trim durations. Large trims are expected when fixtures contain long pre-roll, but a trim that starts near the middle of a short performance should be reviewed before accepting.
