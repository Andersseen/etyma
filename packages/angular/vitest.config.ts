import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Analog's Angular plugin is what compiles decorators for Vitest. It is a dev dependency
  // only: nothing in the published package knows Analog exists.
  plugins: [angular({ tsconfig: 'tsconfig.json' })],
  test: {
    name: '@etyma/angular',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
