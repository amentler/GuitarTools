import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const scriptPath = path.resolve(process.cwd(), 'scripts/auto-update-version.sh');

function callShell(functionName, arg) {
  const escapedArg = arg.replace(/'/g, `'\\''`);
  return execFileSync('bash', [
    '-lc',
    `source '${scriptPath}'; ${functionName} '${escapedArg}'`,
  ], {
    encoding: 'utf8',
  }).trim();
}

describe('auto-update-version.sh helpers', () => {
  it('keeps 0.x versions in the public format when bumping', () => {
    expect(callShell('bump_version', '0.9')).toBe('0.10');
    expect(callShell('bump_version', '0.10')).toBe('0.11');
    expect(callShell('bump_version', '0.999')).toBe('0.1000');
  });

  it('maps previously broken 1.x/2.x versions back into the 0.x counter space', () => {
    expect(callShell('normalize_version_counter', '1.0')).toBe('10');
    expect(callShell('normalize_version_counter', '2.3')).toBe('23');
    expect(callShell('bump_version', '2.3')).toBe('0.24');
  });
});
