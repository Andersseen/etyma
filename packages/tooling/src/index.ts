/**
 * Static validation for Etyma message catalogs.
 *
 * A development-time package: nothing here reads a filesystem, spawns a process, or prints
 * to a console. It takes catalog objects already in memory and returns structured
 * diagnostics — the same shape a future `@etyma/cli`, an MCP tool, a Vite plugin or Forge
 * CMS can all build on without validating catalogs a second way each.
 *
 * @packageDocumentation
 */

export { extractContractKeys, renderContractModule } from './generate-contract.js';
export { validateCatalog } from './validate-catalog.js';
export { validateCatalogs } from './validate-catalogs.js';

export type {
  CatalogDiagnostic,
  CatalogValidationResult,
  DiagnosticSeverity,
  ValidateCatalogOptions,
  ValidateCatalogsOptions,
} from './types.js';
