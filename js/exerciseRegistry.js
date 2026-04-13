/**
 * Exercise registry – exercises self-register via `routeMeta`.
 * `app.js` uses this map to navigate, start, and stop exercises
 * without any hardcoded if/else chains.
 */

const registry = new Map();

/**
 * Called once per exercise module at import time.
 * @param {string} key
 * @param {{ viewId: string, btnStartId: string, btnBackId: string, start: Function, stop: Function }} meta
 */
export function registerExercise(key, meta) {
  registry.set(key, meta);
}

/** @param {string} key */
export function getExercise(key) { return registry.get(key); }

export function getAllExercises() { return [...registry.entries()]; }
