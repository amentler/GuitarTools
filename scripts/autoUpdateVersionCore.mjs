export function normalizeVersionCounter(version) {
  if (!/^[0-9]+(\.[0-9]+)?$/.test(version)) {
    throw new Error(`Invalid version: ${version}`);
  }

  const [whole, rawFraction = '0'] = version.split('.');
  if (whole === '0') {
    return rawFraction;
  }

  return `${whole}${rawFraction}`;
}

export function formatVersionFromCounter(counter) {
  return `0.${counter}`;
}

export function bumpVersion(currentVersion) {
  const counter = Number.parseInt(normalizeVersionCounter(currentVersion), 10) + 1;
  return formatVersionFromCounter(counter);
}

function main() {
  const [, , command, value] = process.argv;

  if (!command || !value) {
    console.error('Usage: node scripts/autoUpdateVersionCore.mjs <normalize|format|bump> <value>');
    process.exit(1);
  }

  switch (command) {
    case 'normalize':
      console.log(normalizeVersionCounter(value));
      return;
    case 'format':
      console.log(formatVersionFromCounter(value));
      return;
    case 'bump':
      console.log(bumpVersion(value));
      return;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
