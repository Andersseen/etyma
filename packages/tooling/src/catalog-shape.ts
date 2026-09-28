import {
  type Locale,
  type MessageSource,
  type MessageSourceProblem,
  walkMessageSource,
} from '@etyma/core';

import type { CatalogDiagnostic } from './types.js';

export interface CatalogShape {
  /** Every message leaf found, by dotted key. Structurally invalid nodes are excluded. */
  readonly leaves: ReadonlyMap<string, string>;
  readonly diagnostics: readonly CatalogDiagnostic[];
}

/**
 * Walks one catalog's shape, reusing `@etyma/core`'s own catalog tree-walk rather than a
 * second dotted-path traversal — the same primitive {@link flattenMessages} builds a
 * `MessageCatalog` from, used here in its tolerant form so every problem is collected
 * instead of the first one winning.
 */
export function walkCatalogShape(locale: Locale, catalog: MessageSource): CatalogShape {
  const leaves = new Map<string, string>();
  const diagnostics: CatalogDiagnostic[] = [];

  walkMessageSource(
    catalog,
    leaf => leaves.set(leaf.path, leaf.value),
    problem => diagnostics.push(shapeDiagnostic(locale, problem)),
  );

  return { leaves, diagnostics };
}

function shapeDiagnostic(locale: Locale, problem: MessageSourceProblem): CatalogDiagnostic {
  switch (problem.kind) {
    case 'invalid-root':
      return {
        code: 'catalog.invalid-root',
        severity: 'error',
        locale,
        message: `Catalog root is ${describe(problem.value)}; expected an object of messages.`,
      };

    case 'empty-key':
      return {
        code: 'catalog.empty-key',
        severity: 'error',
        locale,
        message: `Empty key${problem.path ? ` under "${problem.path.slice(0, -1)}"` : ''}.`,
      };

    case 'dotted-key':
      return {
        code: 'catalog.dotted-key',
        severity: 'error',
        locale,
        key: problem.path,
        message:
          `Key "${problem.path}" contains a "."; dots separate nesting levels and cannot ` +
          'appear inside a key.',
      };

    case 'duplicate-key':
      return {
        code: 'catalog.duplicate-key',
        severity: 'error',
        locale,
        key: problem.path,
        message: `Duplicate key "${problem.path}".`,
      };

    case 'invalid-leaf':
      return {
        code: 'catalog.invalid-leaf',
        severity: 'error',
        locale,
        key: problem.path,
        message:
          `"${problem.path}" is ${describe(problem.value)}; message values must be strings, ` +
          'nested objects of messages, or non-empty arrays of strings, and array elements ' +
          'must be strings.',
      };

    case 'empty-array':
      return {
        code: 'catalog.empty-array',
        severity: 'error',
        locale,
        key: problem.path,
        message:
          `"${problem.path}" is an empty array; an array of messages must contain at least ` +
          'one string.',
      };
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';

  return `a ${typeof value}`;
}
