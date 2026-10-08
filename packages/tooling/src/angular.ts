/**
 * Conservative Angular template analysis for statically provable Etyma translator bindings.
 * This subpath alone loads the optional `@angular/compiler` peer.
 *
 * @packageDocumentation
 */

export { analyzeAngularMessageUsage } from './analyze-angular-message-usage.js';

export type { AnalyzeAngularMessageUsageOptions } from './analyze-angular-message-usage.js';
export type {
  MessageUsageAnalysis,
  SourceDiagnostic,
  SourceDiagnosticCode,
  SourceFile,
} from './source-types.js';
