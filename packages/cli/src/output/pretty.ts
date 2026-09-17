import type { CatalogDiagnostic, CatalogValidationResult } from '@etyma/tooling';

export interface PrettySummary {
  readonly locales: readonly string[];
  readonly messageCount: number;
}

/**
 * Renders a `CatalogValidationResult` for a terminal.
 *
 * No ANSI colour: colour would need `NO_COLOR` handling and complicates snapshot testing for
 * a first release that is meant to be easy to keep correct - see the package README's
 * non-goals. Diagnostics arrive already sorted by locale, then key, then code
 * (`@etyma/tooling`'s own contract), so grouping them by locale here preserves that order
 * without a second sort.
 */
export function formatPretty(result: CatalogValidationResult, summary: PrettySummary): string {
  if (result.valid) {
    return [
      `✓ ${summary.locales.length} ${plural(summary.locales.length, 'locale')}`,
      `✓ ${summary.messageCount} ${plural(summary.messageCount, 'message')}`,
      '✓ Catalogs are valid',
      '',
    ].join('\n');
  }

  const lines: string[] = [];

  for (const [locale, diagnostics] of groupByLocale(result.diagnostics)) {
    lines.push(locale.toUpperCase(), '');

    for (const diagnostic of diagnostics) {
      lines.push(`${diagnostic.severity.toUpperCase()} ${diagnostic.code}`);

      if (diagnostic.key !== undefined) {
        lines.push(diagnostic.key);
      }

      lines.push(diagnostic.message, '');
    }
  }

  const errorCount = result.diagnostics.filter(
    diagnostic => diagnostic.severity === 'error',
  ).length;
  const warningCount = result.diagnostics.length - errorCount;

  lines.push(
    `✗ ${errorCount} ${plural(errorCount, 'error')}, ${warningCount} ${plural(warningCount, 'warning')}`,
  );

  return `${lines.join('\n')}\n`;
}

function groupByLocale(
  diagnostics: readonly CatalogDiagnostic[],
): readonly (readonly [string, CatalogDiagnostic[]])[] {
  const groups = new Map<string, CatalogDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const key = diagnostic.locale ?? '(general)';
    const group = groups.get(key);

    if (group) {
      group.push(diagnostic);
    } else {
      groups.set(key, [diagnostic]);
    }
  }

  return [...groups.entries()];
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
