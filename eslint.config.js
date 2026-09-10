import js from '@eslint/js';
import angular from '@angular-eslint/eslint-plugin';
import angularTemplate from '@angular-eslint/eslint-plugin-template';
import templateParser from '@angular-eslint/template-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * The dependency direction, enforced rather than documented.
 *
 * `@etyma/core` is the portable engine: it must not know that Angular exists, or it stops
 * being portable and a future adapter starts by deleting things. `@etyma/angular` must not
 * know that Analog exists, or the Angular package drags a meta-framework into every
 * application that only wanted signals. Package manifests already say this; this makes an
 * import that contradicts them fail in the editor rather than at publish time.
 */
const layerBoundaries = [
  {
    files: ['packages/core/src/**/*.ts'],
    restricted: {
      patterns: [
        {
          group: ['@angular/*', '@analogjs/*', '@etyma/angular', '@etyma/analog', 'rxjs*'],
          message:
            '@etyma/core is framework agnostic. It may not import Angular, Analog or any ' +
            'other framework - only standards (Intl, MessageFormat 2).',
        },
        {
          group: ['@etyma/tooling'],
          message:
            '@etyma/core must never depend on @etyma/tooling. Tooling is built on top of ' +
            'core, never the other way around.',
        },
        {
          group: ['node:*', 'fs', 'path', 'url', 'crypto'],
          message:
            '@etyma/core runs in browsers and in edge runtimes such as Cloudflare Workers, ' +
            'so it may not import Node built-ins.',
        },
      ],
    },
  },
  {
    files: ['packages/angular/src/**/*.ts'],
    restricted: {
      patterns: [
        {
          group: ['@analogjs/*', '@etyma/analog'],
          message:
            '@etyma/angular must work in any Angular application. Analog-specific behaviour ' +
            'belongs in @etyma/analog, which depends on this package and not the other way ' +
            'around.',
        },
        {
          group: ['@etyma/tooling'],
          message:
            '@etyma/angular must never depend on @etyma/tooling. Tooling is a development-time ' +
            'package and must not become part of a runtime dependency graph.',
        },
      ],
    },
  },
  {
    files: ['packages/analog/src/**/*.ts'],
    restricted: {
      patterns: [
        {
          group: ['@etyma/tooling'],
          message:
            '@etyma/analog must never depend on @etyma/tooling. Tooling is a development-time ' +
            'package and must not become part of a runtime dependency graph.',
        },
      ],
    },
  },
  {
    files: ['packages/tooling/src/**/*.ts'],
    restricted: {
      patterns: [
        {
          group: ['@angular/*', '@analogjs/*', '@etyma/angular', '@etyma/analog', 'rxjs*'],
          message:
            '@etyma/tooling is framework agnostic development tooling. It may not import ' +
            'Angular, Analog or any other framework - only standards and @etyma/core.',
        },
        {
          group: ['node:*', 'fs', 'path', 'url', 'crypto'],
          message:
            '@etyma/tooling validates already-loaded catalog objects and must run in a ' +
            'browser or edge runtime too - a future CMS or MCP integration - so it may not ' +
            'import Node built-ins. Filesystem access belongs in a future CLI adapter.',
        },
      ],
    },
  },
];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/dist-spec/**',
      '**/.nitro/**',
      '**/.output/**',
      '**/.wrangler/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Compatibility fixtures are not workspace source: their `src` is copied in at run
      // time and their dependencies are packed tarballs, so there is no project for the
      // type-aware rules to read. Each fixture runs its own `tsc` against a real Angular.
      'tools/compat/**',
    ],
  },

  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.node },
    },
    rules: {
      // A translated string is data. Nothing here should be building elements from one.
      'no-restricted-properties': [
        'error',
        {
          property: 'innerHTML',
          message:
            'Assigning innerHTML would make a translation catalog an injection vector. Use ' +
            'text, or MessageFormat 2 parts through `parts()`.',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },

  ...layerBoundaries.map(({ files, restricted }) => ({
    files,
    rules: { 'no-restricted-imports': ['error', restricted] },
  })),

  {
    files: ['packages/{angular,analog}/**/*.ts', 'apps/playground/src/**/*.ts'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { '@angular-eslint': angular },
    processor: angularTemplate.processors['extract-inline-html'],
    rules: {
      ...angular.configs.recommended.rules,
      '@angular-eslint/component-class-suffix': 'off',
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'etyma', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: ['etyma', 'app'], style: 'kebab-case' },
      ],
      '@angular-eslint/prefer-standalone': 'off',
    },
  },

  {
    // Inline templates are extracted into virtual `.html` files, which have no TypeScript
    // program behind them - so the type-aware rules have to be off here or they throw.
    files: ['**/*.html'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: { parser: templateParser },
    plugins: { '@angular-eslint/template': angularTemplate },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      ...angularTemplate.configs.recommended.rules,
      ...angularTemplate.configs.accessibility.rules,
    },
  },

  {
    files: ['**/*.spec.ts', '**/*.test-d.ts', '**/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },

  prettier,
);
