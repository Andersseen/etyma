/**
 * Static validation and contract generation for Etyma message catalogs.
 *
 * A development-time package: nothing here reads a filesystem, spawns a process, or prints
 * to a console. It takes catalog objects already in memory and returns structured
 * diagnostics, or the text of a generated contract module — what `@etyma/cli`, a Vite plugin,
 * an MCP tool or a CMS can all build on without validating catalogs a second way each.
 *
 * @packageDocumentation
 */

export {
  extractContractKeys,
  extractContractVariables,
  renderContractModule,
} from './generate-contract.js';
export { validateCatalog } from './validate-catalog.js';
export { validateCatalogs } from './validate-catalogs.js';

export type {
  CatalogDiagnostic,
  CatalogValidationResult,
  DiagnosticSeverity,
  ValidateCatalogOptions,
  ValidateCatalogsOptions,
} from './types.js';
export type { ExtractContractVariablesOptions } from './generate-contract.js';
