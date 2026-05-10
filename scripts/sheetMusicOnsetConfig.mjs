import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DEFAULT_GUITAR_ONSET_OPTIONS } from '../js/shared/audio/guitarOnsetDetector.js';

const ANALYSIS_OPTION_KEYS = new Set([
  'onsetFrameSize',
  'onsetHopSize',
  'analyzeIntervalMs',
]);

const DETECTOR_OPTION_KEYS = new Set(Object.keys(DEFAULT_GUITAR_ONSET_OPTIONS));

function readConfigPath(argv) {
  const index = argv.indexOf('--onset-config');
  if (index === -1) return null;
  const configPath = argv[index + 1];
  if (!configPath || configPath.startsWith('--')) {
    throw new Error('--onset-config requires a JSON file path');
  }
  return resolve(process.cwd(), configPath);
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
}

function normalizeConfig(rawConfig) {
  assertPlainObject(rawConfig, 'onset config');

  const options = {};
  const detectorOptions = {};

  for (const key of ANALYSIS_OPTION_KEYS) {
    if (rawConfig[key] !== undefined) options[key] = rawConfig[key];
  }

  if (rawConfig.onsetDetectorOptions !== undefined) {
    assertPlainObject(rawConfig.onsetDetectorOptions, 'onsetDetectorOptions');
    Object.assign(detectorOptions, rawConfig.onsetDetectorOptions);
  }

  for (const key of DETECTOR_OPTION_KEYS) {
    if (rawConfig[key] !== undefined) detectorOptions[key] = rawConfig[key];
  }

  if (Object.keys(detectorOptions).length > 0) {
    options.onsetDetectorOptions = detectorOptions;
  }

  return options;
}

export function loadSheetMusicOnsetConfigFromArgs(argv = process.argv.slice(2)) {
  const configPath = readConfigPath(argv);
  if (!configPath) return { configPath: null, options: {} };

  const rawConfig = JSON.parse(readFileSync(configPath, 'utf8'));
  return {
    configPath,
    options: normalizeConfig(rawConfig),
  };
}
