import type { CatalogDiagnostic, CatalogValidationResult } from './types.js';

/**
 * Sorts diagnostics deterministically — by locale, then key, then code — and computes
 * `valid`. The same catalogs always produce the same `diagnostics` array in the same order,
 * which is what makes a snapshot, a CI gate or a CMS diff meaningful.
 */
export function toResult(diagnostics: readonly CatalogDiagnostic[]): CatalogValidationResult {
  const sorted = [...diagnostics].sort(
    (a, b) =>
      (a.locale ?? '').localeCompare(b.locale ?? '') ||
      (a.key ?? '').localeCompare(b.key ?? '') ||
      a.code.localeCompare(b.code),
  );

  return {
    valid: sorted.every(diagnostic => diagnostic.severity !== 'error'),
    diagnostics: sorted,
  };
}
