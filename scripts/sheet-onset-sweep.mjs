import {
  appendFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import { readWavFile } from '../tests/helpers/wavDecoder.js';
import { countGuitarOnsets } from '../tests/helpers/sheetMusicSequenceFingerprint.js';
import {
  candidateKey,
  candidateToOptions,
  createInitialCandidates,
  createRefinedCandidates,
  createSeededRandom,
  discoverSweepFixtures,
  ensureRunDir,
  formatCsvRow,
  formatReport,
  formatSweepHelp,
  loadSweepSpec,
  parseArgs,
  readJsonl,
  scoreCandidate,
  sortResults,
  writeJson,
} from './sheetOnsetSweepCore.mjs';

function makeCandidateId(round, index, parameters) {
  const hash = candidateKey(parameters)
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0)
    .toString(16)
    .padStart(8, '0');
  return `r${String(round).padStart(3, '0')}-${String(index).padStart(4, '0')}-${hash}`;
}

function loadAudioFixtures(fixtures) {
  return fixtures.map(fixture => ({
    fixture,
    audio: readWavFile(fixture.wavPath),
  }));
}

function evaluateCandidate(candidate, loadedFixtures, scoreSpec) {
  const options = candidateToOptions(candidate.parameters);
  const fixtureResults = loadedFixtures.map(({ fixture, audio }) => {
    const onsetResult = countGuitarOnsets(audio.samples, audio.sampleRate, options);
    return {
      fixture,
      onsetCount: onsetResult.count,
      timestampsMs: onsetResult.timestampsMs,
    };
  });
  return scoreCandidate(candidate, fixtureResults, scoreSpec);
}

function writeResultArtifacts(runDir, spec, fixtures, results) {
  const sorted = sortResults(results);
  const best = sorted.slice(0, spec.beamSize);
  writeJson(join(runDir, 'best.json'), best);
  writeFileSync(join(runDir, 'report.md'), formatReport(results, spec, fixtures));

  const csvHeader = formatCsvRow([
    'rank',
    'id',
    'round',
    'score',
    'exact',
    'under',
    'over',
    'extremeOver',
    'totalOnsets',
    'parameters',
  ]);
  const csvRows = sorted.map((row, index) => formatCsvRow([
    index + 1,
    row.id,
    row.round,
    row.score,
    row.metrics.exact,
    row.metrics.under,
    row.metrics.over,
    row.metrics.extremeOver,
    row.metrics.totalOnsets,
    JSON.stringify(row.parameters),
  ]));
  writeFileSync(join(runDir, 'results.csv'), `${[csvHeader, ...csvRows].join('\n')}\n`);

  best.forEach((row, index) => {
    writeJson(join(runDir, `best-${String(index + 1).padStart(3, '0')}.config.json`), {
      ...row.options,
      _sweep: {
        id: row.id,
        rank: index + 1,
        score: row.score,
        metrics: row.metrics,
      },
    });
  });
}

function appendResult(runDir, result) {
  mkdirSync(runDir, { recursive: true });
  appendFileSync(join(runDir, 'results.jsonl'), `${JSON.stringify(result)}\n`);
}

function dueToStop(startedAt, spec, totalEvaluated, maxCandidates) {
  if (Number.isFinite(maxCandidates) && totalEvaluated >= maxCandidates) return 'max-candidates';
  if (Number.isFinite(spec.timeBudgetMinutes)) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= spec.timeBudgetMinutes * 60_000) return 'time-budget';
  }
  return null;
}

async function main() {
  const args = parseArgs();
  if (args.help) {
    console.log(formatSweepHelp());
    return;
  }

  const spec = loadSweepSpec(args.specPath);

  const fixtures = discoverSweepFixtures(spec);
  if (fixtures.length === 0) {
    throw new Error(`No WAV fixtures found in ${spec.fixturesDir}`);
  }

  if (args.dryRun) {
    console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
    console.log(`[sheet-onset-sweep] output dir: ${spec.outputDir}`);
    console.log(`[sheet-onset-sweep] parameters: ${Object.keys(spec.parameters).join(', ')}`);
    return;
  }

  const runDir = ensureRunDir(spec, args.resumeDir);
  mkdirSync(join(runDir, 'rounds'), { recursive: true });
  const loadedFixtures = loadAudioFixtures(fixtures);
  const previousResults = readJsonl(join(runDir, 'results.jsonl'));
  const seen = new Set(previousResults.map(row => candidateKey(row.parameters)));
  const results = [...previousResults];
  const random = createSeededRandom((spec.seed ?? 1337) + results.length);
  const startedAt = Date.now();
  const startRound = previousResults.length > 0
    ? Math.max(...previousResults.map(row => row.round ?? 0)) + 1
    : 1;

  writeJson(join(runDir, 'sweep-spec.json'), spec);
  writeJson(join(runDir, 'fixtures.json'), fixtures.map(fixture => ({
    file: fixture.file,
    role: fixture.role,
    expectedCount: fixture.expectedCount,
    minOnsets: fixture.minOnsets,
    maxOnsets: fixture.maxOnsets,
    weight: fixture.weight,
  })));

  console.log(`[sheet-onset-sweep] run dir: ${runDir}`);
  console.log(`[sheet-onset-sweep] fixtures: ${fixtures.length}`);
  console.log(`[sheet-onset-sweep] resumed candidates: ${results.length}`);

  for (let round = startRound; round <= spec.rounds; round++) {
    const stopReason = dueToStop(startedAt, spec, results.length, args.maxCandidates);
    if (stopReason) {
      console.log(`[sheet-onset-sweep] stopping before round ${round}: ${stopReason}`);
      break;
    }

    const beam = sortResults(results).slice(0, spec.beamSize);
    const rawCandidates = round === 1 && beam.length === 0
      ? createInitialCandidates(spec, spec.candidatesPerRound, random)
      : createRefinedCandidates(spec, beam, spec.candidatesPerRound, round, random);
    const roundResults = [];

    for (const [index, parameters] of rawCandidates.entries()) {
      const key = candidateKey(parameters);
      if (seen.has(key)) continue;
      seen.add(key);

      const candidate = {
        id: makeCandidateId(round, index + 1, parameters),
        round,
        parameters,
      };
      const result = evaluateCandidate(candidate, loadedFixtures, spec.score);
      results.push(result);
      roundResults.push(result);
      appendResult(runDir, result);

      const stopReasonAfterCandidate = dueToStop(startedAt, spec, results.length, args.maxCandidates);
      if (stopReasonAfterCandidate) {
        console.log(`[sheet-onset-sweep] stopping during round ${round}: ${stopReasonAfterCandidate}`);
        break;
      }
    }

    writeJson(join(runDir, 'rounds', `round-${String(round).padStart(3, '0')}.json`), {
      round,
      evaluated: roundResults.length,
      best: sortResults(results).slice(0, spec.beamSize),
    });
    writeResultArtifacts(runDir, spec, fixtures, results);

    const best = sortResults(results)[0];
    console.log(
      `[sheet-onset-sweep] round ${round}: evaluated ${roundResults.length}, `
      + `best score ${best?.score.toFixed(2) ?? 'n/a'} (${best?.id ?? '-'})`,
    );
  }

  writeResultArtifacts(runDir, spec, fixtures, results);
  const best = sortResults(results)[0];
  console.log(`[sheet-onset-sweep] done: ${results.length} candidates`);
  if (best) {
    console.log(`[sheet-onset-sweep] best: ${best.id} score=${best.score.toFixed(2)}`);
    console.log(`[sheet-onset-sweep] best config: ${join(runDir, 'best-001.config.json')}`);
  }
}

main().catch(err => {
  console.error(`[sheet-onset-sweep] ${err.stack || err.message}`);
  process.exitCode = 1;
});
