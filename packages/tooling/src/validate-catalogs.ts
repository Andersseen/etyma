import type { Locale } from '@etyma/core';

import { analyzeCatalog, type CatalogAnalysis } from './catalog-analysis.js';
import type { MessageAnalysis } from './message-analysis.js';
import { toResult } from './result.js';
import type {
  CatalogDiagnostic,
  CatalogValidationResult,
  ValidateCatalogsOptions,
} from './types.js';

/**
 * Validates a set of catalogs against their source locale's contract.
 *
 * The source catalog defines the key set every other locale is measured against: a key it
 * lacks is `catalog.missing-key`, a key only a translation has is `catalog.extra-key`, and
 * every message's external MessageFormat 2 variables are compared the same way. Every
 * catalog — including the source's own — is also validated on its own terms through the
 * same checks {@link validateCatalog} runs, so a broken source message is reported too.
 */
export function validateCatalogs(options: ValidateCatalogsOptions): CatalogValidationResult {
  const diagnostics: CatalogDiagnostic[] = [];
  const { sourceLocale } = options;
  const entries = Object.entries(options.catalogs ?? {});

  if (!sourceLocale) {
    diagnostics.push({
      code: 'config.no-source-locale',
      severity: 'error',
      message: 'No `sourceLocale` was given.',
    });
  }

  if (entries.length === 0) {
    diagnostics.push({
      code: 'config.no-catalogs',
      severity: 'error',
      message: 'No catalogs were given.',
    });

    return toResult(diagnostics);
  }

  if (sourceLocale && !Object.hasOwn(options.catalogs ?? {}, sourceLocale)) {
    diagnostics.push({
      code: 'config.source-catalog-missing',
      severity: 'error',
      locale: sourceLocale,
      message: `sourceLocale "${sourceLocale}" has no catalog in \`catalogs\`.`,
    });
  }

  diagnostics.push(...duplicateLocaleDiagnostics(entries.map(([locale]) => locale)));

  const analyses = new Map<Locale, CatalogAnalysis>();

  for (const [locale, catalog] of entries) {
    const analysis = analyzeCatalog(locale, catalog);
    analyses.set(locale, analysis);
    diagnostics.push(...analysis.diagnostics);
  }

  if (sourceLocale !== undefined) {
    const sourceAnalysis = analyses.get(sourceLocale);

    if (sourceAnalysis) {
      for (const [locale, analysis] of analyses) {
        if (locale !== sourceLocale) {
          diagnostics.push(...compareToSource(sourceLocale, sourceAnalysis, locale, analysis));
        }
      }
    }
  }

  return toResult(diagnostics);
}

/**
 * Two locale keys that canonicalize to the same BCP 47 tag, such as `"en-US"` and `"en-us"`.
 *
 * A single malformed tag is reported per-catalog as `config.invalid-locale`; this only
 * looks for collisions between tags that are each individually well-formed, so a malformed
 * one is not reported twice under two different codes.
 */
function duplicateLocaleDiagnostics(locales: readonly Locale[]): CatalogDiagnostic[] {
  const byCanonical = new Map<string, Locale[]>();

  for (const locale of locales) {
    let canonical: string;

    try {
      canonical = Intl.getCanonicalLocales(locale)[0] ?? locale;
    } catch {
      continue;
    }

    const group = byCanonical.get(canonical) ?? [];
    group.push(locale);
    byCanonical.set(canonical, group);
  }

  const diagnostics: CatalogDiagnostic[] = [];

  for (const group of byCanonical.values()) {
    if (group.length < 2) {
      continue;
    }

    for (const locale of group) {
      const others = group.filter(other => other !== locale).map(other => `"${other}"`);

      diagnostics.push({
        code: 'config.duplicate-locale',
        severity: 'error',
        locale,
        message: `Locale "${locale}" is the same BCP 47 tag as ${others.join(', ')}.`,
      });
    }
  }

  return diagnostics;
}

function compareToSource(
  sourceLocale: Locale,
  source: CatalogAnalysis,
  locale: Locale,
  target: CatalogAnalysis,
): CatalogDiagnostic[] {
  const diagnostics: CatalogDiagnostic[] = [];

  const sourceKeys = new Set(source.leaves.keys());
  const targetKeys = new Set(target.leaves.keys());

  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      diagnostics.push({
        code: 'catalog.missing-key',
        severity: 'error',
        locale,
        key,
        message: `"${key}" exists in the source locale "${sourceLocale}" but has no translation in "${locale}".`,
      });
    }
  }

  for (const key of targetKeys) {
    if (!sourceKeys.has(key)) {
      diagnostics.push({
        code: 'catalog.extra-key',
        severity: 'error',
        locale,
        key,
        message: `"${key}" exists in "${locale}" but not in the source locale "${sourceLocale}"; it is unreachable through the typed key contract.`,
      });
    }
  }

  for (const key of sourceKeys) {
    if (!targetKeys.has(key)) {
      continue;
    }

    const sourceAnalysis = source.analyses.get(key);
    const targetAnalysis = target.analyses.get(key);

    if (sourceAnalysis && targetAnalysis) {
      diagnostics.push(...compareVariables(locale, key, sourceAnalysis, targetAnalysis));
    }
  }

  return diagnostics;
}

function compareVariables(
  locale: Locale,
  key: string,
  source: MessageAnalysis,
  target: MessageAnalysis,
): CatalogDiagnostic[] {
  const diagnostics: CatalogDiagnostic[] = [];

  // One side failed to parse; its own message.invalid-syntax diagnostic already covers it,
  // and there is no reliable variable contract left to compare.
  if (!source.variables || !target.variables) {
    return diagnostics;
  }

  for (const name of source.variables) {
    if (!target.variables.has(name)) {
      diagnostics.push({
        code: 'message.missing-variable',
        severity: 'error',
        locale,
        key,
        message: `Variable "${name}" is used in the source message but missing from the "${locale}" translation.`,
      });
    }
  }

  for (const name of target.variables) {
    if (!source.variables.has(name)) {
      diagnostics.push({
        code: 'message.extra-variable',
        severity: 'error',
        locale,
        key,
        message: `Variable "${name}" is used in the "${locale}" translation but not in the source message.`,
      });
    }
  }

  for (const name of source.variables) {
    if (!target.variables.has(name)) {
      continue; // already reported as message.missing-variable
    }

    diagnostics.push(...compareVariableFunction(locale, key, name, source, target));
  }

  return diagnostics;
}

/**
 * Best-effort comparison of the `:function` annotating a shared external variable, e.g.
 * source `{$count :number}` against a translation's bare `{$count}`.
 *
 * Deliberately narrow: it only compares a variable's *own* direct annotation, read from the
 * real parsed structure via {@link collectVariableFunctions}, never a regex. When a variable
 * is annotated with more than one distinct function within the same message — which MF2
 * allows across different branches — the comparison is skipped for that message rather than
 * guessing which one is "the" type. A warning, not an error: the specification does not
 * require the two sides to agree, and this is a signal worth a human's attention rather
 * than a broken contract.
 */
function compareVariableFunction(
  locale: Locale,
  key: string,
  name: string,
  source: MessageAnalysis,
  target: MessageAnalysis,
): CatalogDiagnostic[] {
  const sourceFn = functionAnnotation(source.variableFunctions.get(name));

  if (sourceFn.kind !== 'one') {
    return [];
  }

  const targetFn = functionAnnotation(target.variableFunctions.get(name));

  if (targetFn.kind === 'ambiguous') {
    return [];
  }

  if (targetFn.kind === 'one' && targetFn.name === sourceFn.name) {
    return [];
  }

  const message =
    targetFn.kind === 'none'
      ? `Variable "${name}" is formatted with ":${sourceFn.name}" in the source message but ` +
        `has no function annotation in the "${locale}" translation.`
      : `Variable "${name}" is formatted with ":${sourceFn.name}" in the source message but ` +
        `":${targetFn.name}" in the "${locale}" translation.`;

  return [
    { code: 'message.variable-function-mismatch', severity: 'warning', locale, key, message },
  ];
}

type FunctionAnnotation =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly name: string }
  | { readonly kind: 'ambiguous' };

function functionAnnotation(functions: ReadonlySet<string> | undefined): FunctionAnnotation {
  let only: string | undefined;

  for (const name of functions ?? []) {
    if (only !== undefined) {
      return { kind: 'ambiguous' };
    }

    only = name;
  }

  return only === undefined ? { kind: 'none' } : { kind: 'one', name: only };
}
