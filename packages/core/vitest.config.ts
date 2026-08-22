import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: '@etyma/core',
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Typed message keys are a feature, so the types are asserted rather than assumed:
    // `expectTypeOf` only means anything when the compiler actually runs over it.
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
      tsconfig: 'tsconfig.json',
    },
  },
});
