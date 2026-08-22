import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [angular({ tsconfig: 'tsconfig.json' })],
  test: {
    name: '@etyma/analog',
    environment: 'jsdom',
    globals: false,
    setupFiles: ['vitest.setup.ts'],
    include: ['src/**/*.spec.ts'],
  },
});
