import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@etyma/tooling',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
