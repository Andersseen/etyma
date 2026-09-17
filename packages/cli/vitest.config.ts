import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@etyma/cli',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
