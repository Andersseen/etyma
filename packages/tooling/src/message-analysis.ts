import {
  type Model,
  type MessageDataModelError,
  parseMessage,
  validate,
  visit,
} from 'messageformat';

import type { CatalogDiagnostic } from './types.js';

/**
 * What parsing and validating one MessageFormat 2 pattern found.
 *
 * Built once per message and reused for every check that needs it — syntax and data-model
 * diagnostics, external variable parity, and the best-effort function-annotation comparison
 * — so a catalog with several thousand messages parses each pattern exactly once.
 */
export interface MessageAnalysis {
  /** The parsed message, or `undefined` when `source` is not valid MessageFormat 2 syntax. */
  readonly message: Model.Message | undefined;

  /**
   * The message's external variable contract: every variable an input must supply, i.e.
   * every variable referenced that is not resolved by a local declaration.
   *
   * `undefined` when the message did not parse — there is no reliable contract to compare.
   */
  readonly variables: ReadonlySet<string> | undefined;

  /**
   * Direct function annotations found on each variable's own usage sites, wherever a
   * `:function` reference is applied to that variable's own reference — as a `.input`
   * declaration, a `.local` declaration, or an inline placeholder.
   *
   * Best-effort and structural only: a variable absent from this map was never directly
   * annotated in the message, which does not necessarily mean it is untyped, only that no
   * annotation was found by walking the parsed pattern.
   */
  readonly variableFunctions: ReadonlyMap<string, ReadonlySet<string>>;

  /** Diagnostics this message produces on its own, with no `locale` or `key` set yet. */
  readonly diagnostics: readonly Omit<CatalogDiagnostic, 'locale' | 'key'>[];
}

const SEMANTIC_ISSUES: Record<
  MessageDataModelError['type'],
  { readonly code: string; readonly description: string }
> = {
  'key-mismatch': {
    code: 'message.mf2-key-mismatch',
    description: 'a variant has a different number of keys than there are selectors',
  },
  'missing-fallback': {
    code: 'message.mf2-missing-fallback',
    description: 'no variant matches every input — there is no all-catch-all variant',
  },
  'missing-selector-annotation': {
    code: 'message.mf2-missing-selector-annotation',
    description: 'a selector variable has no function annotation to select on',
  },
  'duplicate-declaration': {
    code: 'message.mf2-duplicate-declaration',
    description: 'the same variable is declared more than once',
  },
  'duplicate-variant': {
    code: 'message.mf2-duplicate-variant',
    description: 'two variants declare the same keys',
  },
};

/**
 * Parses and validates one MessageFormat 2 pattern, using the same reference implementation
 * (`messageformat`) that formats messages at runtime — never a regex, never a second parser.
 */
export function analyzeMessage(source: string): MessageAnalysis {
  let message: Model.Message;

  try {
    message = parseMessage(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    return {
      message: undefined,
      variables: undefined,
      variableFunctions: new Map(),
      diagnostics: [
        {
          code: 'message.invalid-syntax',
          severity: 'error',
          message: `Invalid MessageFormat 2 syntax: ${detail}`,
        },
      ],
    };
  }

  const diagnostics: Omit<CatalogDiagnostic, 'locale' | 'key'>[] = [];

  const { variables } = validate(message, type => {
    const issue = SEMANTIC_ISSUES[type];

    diagnostics.push({
      code: issue.code,
      severity: 'error',
      message: `Invalid MessageFormat 2 message: ${issue.description}.`,
    });
  });

  return {
    message,
    variables,
    variableFunctions: collectVariableFunctions(message),
    diagnostics,
  };
}

/**
 * Every `:function` annotation found directly on a variable's own reference, anywhere in the
 * message — a declaration's value expression or a pattern placeholder alike.
 *
 * Reads the parsed data model through {@link visit}, the library's own structural walk, so
 * this stays exact for every shape MF2 allows rather than approximating with a pattern match
 * over the source text.
 */
function collectVariableFunctions(message: Model.Message): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  visit(message, {
    expression(expression) {
      if (expression.arg?.type === 'variable' && expression.functionRef) {
        const functions = map.get(expression.arg.name) ?? new Set<string>();
        functions.add(expression.functionRef.name);
        map.set(expression.arg.name, functions);
      }
    },
  });

  return map;
}
