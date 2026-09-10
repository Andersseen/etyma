import { analyzeCatalog } from './catalog-analysis.js';
import { toResult } from './result.js';
import type { CatalogValidationResult, ValidateCatalogOptions } from './types.js';

/**
 * Validates one catalog on its own: its shape, and every message's MessageFormat 2 syntax
 * and data model.
 *
 * This is the narrow primitive — no source catalog, no comparison, no configuration beyond
 * the one locale and catalog given. It is what a single-file editor or a CMS field
 * validator wants: "is this JSON, by itself, a valid Etyma catalog." For missing keys,
 * extra keys and variable parity against a source contract, see {@link validateCatalogs}.
 */
export function validateCatalog(options: ValidateCatalogOptions): CatalogValidationResult {
  return toResult(analyzeCatalog(options.locale, options.catalog).diagnostics);
}
