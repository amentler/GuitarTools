import { describe, expect, it } from 'vitest';
import {
  candidateToOptions,
  createInitialCandidates,
  createRefinedCandidates,
  createSeededRandom,
  formatSweepHelp,
  parseArgs,
  scoreCandidate,
  scoreFixture,
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
    expect(help).toContain('best-001.config.json');
  });

  it('maps analysis and detector parameters to fingerprint options', () => {
    expect(candidateToOptions({
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

  it('scores guardrail overcounts harsher than target undercounts', () => {
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
});
