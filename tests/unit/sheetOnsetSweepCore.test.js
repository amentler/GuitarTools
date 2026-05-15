import { describe, expect, it } from 'vitest';
import {
  candidateToOptions,
  createInitialCandidates,
  createInitialCandidatesForStrategy,
  createRefinedCandidates,
  createRefinedCandidatesForStrategy,
  createSeededRandom,
  createStagnationProbeCandidates,
  formatReport,
  formatSweepHelp,
  parseArgs,
  scoreCandidate,
  scoreFixture,
  scoreTaggedOnsets,
  sortResults,
} from '../../scripts/sheetOnsetSweepCore.mjs';

describe('sheetOnsetSweepCore', () => {
  it('parses help and resume arguments', () => {
    expect(parseArgs(['--help']).help).toBe(true);
    expect(parseArgs(['--spec', 'spec.json', '--resume', 'run-dir'])).toMatchObject({
      specPath: 'spec.json',
      resumeDir: 'run-dir',
    });
  });

  it('formats CLI help with the common commands', () => {
    const help = formatSweepHelp();
    expect(help).toContain('--spec <path>');
    expect(help).toContain('--resume <run-dir>');
    expect(help).toContain('best-by-strategy.json');
    expect(help).toContain('best-<strategy>.config.json');
  });

  it('maps analysis and detector parameters to fingerprint options', () => {
    expect(candidateToOptions({
      strategyKey: 'guitar-onset-sweep-standard',
      analyzeIntervalMs: 25,
      relativeReattackFactor: 2.2,
      cooldownFrames: 3,
    })).toEqual({
      analyzeIntervalMs: 25,
      onsetDetectorOptions: {
        relativeReattackFactor: 2.2,
        cooldownFrames: 3,
      },
    });
  });

  it('generates strategy-specific initial and refined candidates', () => {
    const spec = {
      parameters: {
        cooldownFrames: [2, 5],
        relativeReattackFactor: [1.4, 4.0],
      },
    };
    const initial = createInitialCandidatesForStrategy(
      spec,
      'guitar-onset-broadband-or',
      2,
      createSeededRandom(42),
    );
    const refined = createRefinedCandidatesForStrategy(
      spec,
      'guitar-onset-broadband-or',
      [{ parameters: initial[0] }],
      2,
      2,
      createSeededRandom(7),
    );

    expect(initial).toHaveLength(2);
    expect(refined).toHaveLength(2);
    expect(initial.every(candidate => candidate.strategyKey === 'guitar-onset-broadband-or')).toBe(true);
    expect(refined.every(candidate => candidate.strategyKey === 'guitar-onset-broadband-or')).toBe(true);
  });

  it('scores extreme overcounts harsher than target undercounts', () => {
    const guardrail = {
      file: 'medium.wav',
      role: 'guardrail',
      expectedCount: 16,
      minOnsets: 15,
      maxOnsets: 17,
      weight: 3,
    };
    const target = {
      file: 'fast.wav',
      role: 'target',
      expectedCount: 16,
      minOnsets: 8,
      maxOnsets: 18,
      weight: 2,
    };

    const guardrailOver = scoreFixture(guardrail, 30);
    const targetUnder = scoreFixture(target, 4);

    expect(guardrailOver.score).toBeLessThan(targetUnder.score);
    expect(guardrailOver.extremeOver).toBeGreaterThan(0);
  });

  it('penalizes slight undercounts more than slight overcounts and tracks extreme undercounts', () => {
    const fixture = {
      file: 'sixteen-notes.wav',
      role: 'target',
      expectedCount: 16,
      minOnsets: 13,
      maxOnsets: 18,
      weight: 1,
    };

    const slightUnder = scoreFixture(fixture, 12);
    const slightOver = scoreFixture(fixture, 19);
    const extremeUnder = scoreFixture(fixture, 6);
    const extremeOver = scoreFixture(fixture, 30);

    expect(slightOver.score).toBeGreaterThan(slightUnder.score);
    expect(slightUnder.extremeUnder).toBe(0);
    expect(extremeUnder.extremeUnder).toBeGreaterThan(0);
    expect(extremeUnder.score).toBeLessThan(slightUnder.score);
    expect(extremeOver.extremeOver).toBeGreaterThan(0);
    expect(extremeOver.score).toBeLessThan(slightOver.score);
  });

  it('generates deterministic initial candidates for a seed', () => {
    const spec = {
      parameters: {
        cooldownFrames: [2, 5],
        relativeReattackFactor: [1.4, 4.0],
      },
    };
    const first = createInitialCandidates(spec, 3, createSeededRandom(42));
    const second = createInitialCandidates(spec, 3, createSeededRandom(42));

    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first[0].cooldownFrames).toEqual(Math.round(first[0].cooldownFrames));
  });

  it('refines candidates around the current beam', () => {
    const spec = {
      parameters: {
        cooldownFrames: [2, 5],
        relativeReattackFactor: [1.4, 4.0],
      },
    };
    const beam = [{
      parameters: {
        cooldownFrames: 3,
        relativeReattackFactor: 2.5,
      },
    }];

    const candidates = createRefinedCandidates(spec, beam, 4, 2, createSeededRandom(7));

    expect(candidates).toHaveLength(4);
    for (const candidate of candidates) {
      expect(candidate.cooldownFrames).toBeGreaterThanOrEqual(2);
      expect(candidate.cooldownFrames).toBeLessThanOrEqual(5);
      expect(candidate.relativeReattackFactor).toBeGreaterThanOrEqual(1.4);
      expect(candidate.relativeReattackFactor).toBeLessThanOrEqual(4.0);
    }
  });

  it('sorts scored candidates by score and tie breakers', () => {
    const better = scoreCandidate(
      { id: 'better', round: 1, parameters: { cooldownFrames: 3 } },
      [{
        fixture: {
          file: 'fast.wav',
          role: 'target',
          expectedCount: 16,
          minOnsets: 8,
          maxOnsets: 18,
          weight: 1,
        },
        onsetCount: 12,
      }],
    );
    const worse = scoreCandidate(
      { id: 'worse', round: 1, parameters: { cooldownFrames: 4 } },
      [{
        fixture: {
          file: 'fast.wav',
          role: 'target',
          expectedCount: 16,
          minOnsets: 8,
          maxOnsets: 18,
          weight: 1,
        },
        onsetCount: 2,
      }],
    );

    expect(sortResults([worse, better])[0].id).toBe('better');
  });

  it('scores tagged onsets with good, acceptable, miss and false-positive buckets', () => {
    const score = scoreTaggedOnsets(
      [1000, 2000, 3000],
      [1018, 2042, 3090, 3600],
    );

    expect(score.goodMatches).toBe(1);
    expect(score.acceptableMatches).toBe(1);
    expect(score.misses).toBe(1);
    expect(score.falsePositives).toBe(2);
    expect(score.nearFalsePositives).toBe(1);
    expect(score.farFalsePositives).toBe(1);
    expect(score.p95AbsErrorMs).toBe(42);
  });

  it('penalizes overfiring more than a conservative miss when tagged onsets are available', () => {
    const tagged = [1000, 2000, 3000, 4000];
    const conservative = scoreTaggedOnsets(tagged, [1005, 1998, 3010]);
    const aggressive = scoreTaggedOnsets(tagged, [
      1005,
      1015,
      1998,
      2010,
      3010,
      3020,
      4008,
      4090,
      4600,
    ]);

    expect(conservative.misses).toBe(1);
    expect(aggressive.misses).toBe(0);
    expect(aggressive.falsePositives).toBeGreaterThan(conservative.falsePositives);
    expect(aggressive.score).toBeLessThan(conservative.score);
  });

  it('uses tagged onset timing in candidate scoring when fixture tags exist', () => {
    const scored = scoreCandidate(
      {
        id: 'timed',
        round: 1,
        strategyKey: 'guitar-onset-sweep-standard',
        parameters: { strategyKey: 'guitar-onset-sweep-standard', cooldownFrames: 3 },
      },
      [{
        fixture: {
          file: 'tagged.wav',
          role: 'target',
          expectedCount: 3,
          taggedOnsetsMs: [1000, 2000, 3000],
          minOnsets: 3,
          maxOnsets: 3,
          weight: 1,
        },
        onsetCount: 4,
        timestampsMs: [1004, 2035, 2800, 3600],
      }],
    );

    expect(scored.strategyKey).toBe('guitar-onset-sweep-standard');
    expect(scored.metrics.goodMatches).toBe(1);
    expect(scored.metrics.acceptableMatches).toBe(1);
    expect(scored.metrics.misses).toBe(1);
    expect(scored.metrics.falsePositives).toBe(2);
    expect(scored.fixtures[0].scoringMode).toBe('timed');
  });

  it('formats reports as current best parameters per strategy', () => {
    const results = [
      scoreCandidate(
        {
          id: 'a-worse',
          round: 1,
          strategyKey: 'strategy-a',
          parameters: { strategyKey: 'strategy-a', cooldownFrames: 4 },
        },
        [{
          fixture: {
            file: 'a.wav',
            role: 'target',
            expectedCount: 4,
            minOnsets: 4,
            maxOnsets: 4,
            weight: 1,
          },
          onsetCount: 2,
        }],
      ),
      scoreCandidate(
        {
          id: 'a-best',
          round: 2,
          strategyKey: 'strategy-a',
          parameters: { strategyKey: 'strategy-a', cooldownFrames: 3 },
        },
        [{
          fixture: {
            file: 'a.wav',
            role: 'target',
            expectedCount: 4,
            minOnsets: 4,
            maxOnsets: 4,
            weight: 1,
          },
          onsetCount: 4,
        }],
      ),
      scoreCandidate(
        {
          id: 'b-best',
          round: 1,
          strategyKey: 'strategy-b',
          parameters: { strategyKey: 'strategy-b', relativeReattackFactor: 2.25 },
        },
        [{
          fixture: {
            file: 'b.wav',
            role: 'target',
            expectedCount: 4,
            minOnsets: 4,
            maxOnsets: 4,
            weight: 1,
          },
          onsetCount: 4,
        }],
      ),
    ];

    const report = formatReport(results, { beamSize: 5 }, [{ file: 'a.wav' }]);

    expect(report).toContain('## Current Best By Strategy');
    expect(report).toContain('### strategy-a');
    expect(report).toContain('- id: a-best');
    expect(report).toContain('| cooldownFrames | 3 |');
    expect(report).toContain('### strategy-b');
    expect(report).toContain('| relativeReattackFactor | 2.25 |');
    expect(report).not.toContain('Best Fixture Counts');
  });

  it('creates stagnation probes that vary exactly one parameter from the best candidate', () => {
    const spec = {
      parameters: {
        cooldownFrames: [2, 5],
        relativeReattackFactor: [1.4, 4.0],
        spectralNoveltyRatio: [1.5, 6.0],
      },
    };
    const best = { cooldownFrames: 3, relativeReattackFactor: 2.5, spectralNoveltyRatio: 3.0 };
    const beam = [{ parameters: best }];
    const probes = createStagnationProbeCandidates(spec, 'guitar-onset-sweep-standard', beam, 20, createSeededRandom(99));

    expect(probes).toHaveLength(20);
    expect(probes.every(p => p.strategyKey === 'guitar-onset-sweep-standard')).toBe(true);

    for (const probe of probes) {
      const changedKeys = Object.keys(spec.parameters).filter(key => probe[key] !== best[key]);
      expect(changedKeys.length).toBeLessThanOrEqual(1);
    }
    const anyChanged = probes.some(p => Object.keys(spec.parameters).some(key => p[key] !== best[key]));
    expect(anyChanged).toBe(true);
  });

  it('falls back to initial candidates when beam is empty for stagnation probes', () => {
    const spec = {
      parameters: {
        cooldownFrames: [2, 5],
        relativeReattackFactor: [1.4, 4.0],
      },
    };
    const probes = createStagnationProbeCandidates(spec, 'guitar-onset-sweep-standard', [], 3, createSeededRandom(7));
    expect(probes).toHaveLength(3);
    expect(probes.every(p => p.strategyKey === 'guitar-onset-sweep-standard')).toBe(true);
  });
});
