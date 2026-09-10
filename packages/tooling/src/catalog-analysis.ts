import { isWellFormedLocale, type Locale, type MessageSource } from '@etyma/core';

import { walkCatalogShape } from './catalog-shape.js';
import { analyzeMessage, type MessageAnalysis } from './message-analysis.js';
import type { CatalogDiagnostic } from './types.js';

/**
 * Everything found while checking one catalog on its own: its shape, every message's
 * MessageFormat 2 analysis, and the diagnostics that follow from both.
 *
 * The internal building block behind both {@link validateCatalog} and
 * {@link validateCatalogs}: each message is parsed exactly once here and the result —
 * `analyses` — is what a cross-catalog comparison (key parity, variable parity) reuses,
 * rather than re-parsing the same pattern once per locale pair.
 */
export interface CatalogAnalysis {
  readonly leaves: ReadonlyMap<string, string>;
  readonly analyses: ReadonlyMap<string, MessageAnalysis>;
  readonly diagnostics: readonly CatalogDiagnostic[];
}

export function analyzeCatalog(locale: Locale, catalog: MessageSource): CatalogAnalysis {
  const diagnostics: CatalogDiagnostic[] = [];

  if (!isWellFormedLocale(locale)) {
    diagnostics.push({
      code: 'config.invalid-locale',
      severity: 'error',
      locale,
      message: `"${locale}" is not a well-formed BCP 47 language tag.`,
    });
  }

  const shape = walkCatalogShape(locale, catalog);
  diagnostics.push(...shape.diagnostics);

  const analyses = new Map<string, MessageAnalysis>();

  for (const [key, source] of shape.leaves) {
    if (source.length === 0) {
      diagnostics.push({
        code: 'message.empty',
        severity: 'error',
        locale,
        key,
        message: `"${key}" is empty.`,
      });
    } else if (source.trim().length === 0) {
      diagnostics.push({
        code: 'message.whitespace-only',
        severity: 'error',
        locale,
        key,
        message: `"${key}" contains only whitespace.`,
      });
    }

    const analysis = analyzeMessage(source);
    analyses.set(key, analysis);

    for (const problem of analysis.diagnostics) {
      diagnostics.push({ ...problem, locale, key });
    }
  }

  return { leaves: shape.leaves, analyses, diagnostics };
}
