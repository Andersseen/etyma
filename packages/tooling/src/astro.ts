/**
 * Conservative Astro component analysis. This opt-in subpath alone loads Astro's public
 * compiler parser; it accepts source strings and never reads a project or its configuration.
 *
 * @packageDocumentation
 */

export { analyzeAstroMessageUsage } from './analyze-astro-message-usage.js';

export type { AnalyzeAstroMessageUsageOptions } from './analyze-astro-message-usage.js';
export type {
  MessageUsageAnalysis,
  SourceDiagnostic,
  SourceDiagnosticCode,
  SourceFile,
} from './source-types.js';
