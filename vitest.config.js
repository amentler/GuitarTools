import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    maxWorkers: 2,
    maxConcurrency: 2,
  },
});
