import { compareCodeUnits as compare } from './compare.js';
import type { CatalogDiagnostic, CatalogValidationResult } from './types.js';

/**
 * Sorts diagnostics deterministically — by locale, then key, then code — and computes
 * `valid`. The same catalogs always produce the same `diagnostics` array in the same order,
 * which is what makes a snapshot, a CI gate or a CMS diff meaningful.
 *
 * By UTF-16 code unit, like every other sorted list Etyma produces, and never with
 * `localeCompare`: that collates by the host's default locale, so two CI runners with
 * different `LANG` settings could order the same diagnostics differently.
 */
export function toResult(diagnostics: readonly CatalogDiagnostic[]): CatalogValidationResult {
  const sorted = [...diagnostics].sort(
    (a, b) =>
      compare(a.locale ?? '', b.locale ?? '') ||
      compare(a.key ?? '', b.key ?? '') ||
      compare(a.code, b.code),
  );

  return {
    valid: sorted.every(diagnostic => diagnostic.severity !== 'error'),
    diagnostics: sorted,
  };
}
