import type { MessageUsageAnalysis } from '@etyma/tooling/source';

export interface AnalyzeMeta {
  readonly command: 'analyze';
  readonly directory: string;
  readonly catalog: string;
  readonly fileCount: number;
  readonly catalogKeyCount: number;
  readonly mode?: 'angular' | 'astro';
}

/** Adds CLI metadata while preserving the analyzer's result fields and diagnostic objects. */
export function formatAnalyzeJson(analysis: MessageUsageAnalysis, meta: AnalyzeMeta): string {
  return `${JSON.stringify({ ...analysis, meta }, null, 2)}\n`;
}

export interface AnalyzePrettySummary {
  readonly fileCount: number;
}

/** Deterministic terminal output for an analysis result. */
export function formatAnalyzePretty(
  analysis: MessageUsageAnalysis,
  summary: AnalyzePrettySummary,
): string {
  const lines: string[] = [];

  for (const diagnostic of analysis.diagnostics) {
    lines.push(
      `${diagnostic.path}:${diagnostic.line}:${diagnostic.column}`,
      `  ${diagnostic.severity.toUpperCase()} ${diagnostic.code}`,
    );
    if (diagnostic.key !== undefined) lines.push(`  ${diagnostic.key}`);
    lines.push(`  ${diagnostic.message}`, '');
  }

  lines.push('Unreferenced candidates:');
  if (analysis.unreferenced.length === 0) lines.push('  (none)');
  else lines.push(...analysis.unreferenced.map(key => `  ${key}`));

  const errors = analysis.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  const warnings = analysis.diagnostics.length - errors;
  lines.push(
    '',
    `✓ ${summary.fileCount} ${plural(summary.fileCount, 'file')} analyzed`,
    `✓ ${analysis.used.length} ${plural(analysis.used.length, 'statically referenced key')}`,
    `○ ${analysis.unreferenced.length} ${plural(analysis.unreferenced.length, 'unreferenced candidate')}`,
    `⚠ ${warnings} ${plural(warnings, 'warning')}`,
    `✗ ${errors} ${plural(errors, 'error')}`,
    '',
  );

  return lines.join('\n');
}

function plural(count: number, phrase: string): string {
  return count === 1 ? phrase : `${phrase}s`;
}
