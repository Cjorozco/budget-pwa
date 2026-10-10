/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

// Manual AI evaluations (npm run eval:ai). Kept apart from the default config so `npm test` never calls a paid/limited API.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/evals/**/*.eval.ts'],
    css: false,
  },
});
