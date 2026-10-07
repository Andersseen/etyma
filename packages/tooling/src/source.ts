/**
 * Static analysis of how JavaScript and TypeScript source uses Etyma message keys.
 *
 * Pure and in memory, like the main entry: it takes keys and source text already loaded and
 * returns structured findings. It is a separate subpath because it needs the TypeScript
 * parser, which `import { validateCatalogs } from '@etyma/tooling'` must never load.
 *
 * @packageDocumentation
 */

export { analyzeMessageUsage } from './analyze-message-usage.js';

export type {
  AnalyzeMessageUsageOptions,
  MessageUsageAnalysis,
  SourceDiagnostic,
  SourceDiagnosticCode,
  SourceFile,
} from './source-types.js';
