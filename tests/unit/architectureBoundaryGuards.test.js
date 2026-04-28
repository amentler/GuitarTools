import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function collectJsFiles(rootDir) {
  const entries = readdirSync(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const abs = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsFiles(abs));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(abs);
  }

  return files.sort();
}

function getRelativeImports(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const specs = [];
  const importLike = /\b(?:import|export)\b[\s\S]*?\bfrom\s+['"]([^'"]+)['"]/g;

  for (const match of source.matchAll(importLike)) {
    const spec = match[1];
    if (spec.startsWith('.')) specs.push(spec);
  }

  return specs;
}

function resolveImport(fromFile, specifier) {
  return path.resolve(path.dirname(fromFile), specifier);
}

function toRepoRelative(absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, '/');
}

function findForbiddenImports(rootDir, forbiddenPrefixes) {
  const violations = [];
  const files = collectJsFiles(rootDir);

  for (const file of files) {
    for (const specifier of getRelativeImports(file)) {
      const resolved = resolveImport(file, specifier);
      const relative = toRepoRelative(resolved);
      if (forbiddenPrefixes.some((prefix) => relative.startsWith(prefix))) {
        violations.push({
          file: toRepoRelative(file),
          specifier,
          resolved: relative,
        });
      }
    }
  }

  return violations;
}

describe('architecture boundary guards', () => {
  it('keeps components free from feature/tool imports', () => {
    const violations = findForbiddenImports(path.join(repoRoot, 'js', 'components'), [
      'js/games/',
      'js/tools/',
    ]);

    expect(violations).toEqual([]);
  });

  it('keeps tools free from game imports', () => {
    const violations = findForbiddenImports(path.join(repoRoot, 'js', 'tools'), [
      'js/games/',
    ]);

    expect(violations).toEqual([]);
  });
});
