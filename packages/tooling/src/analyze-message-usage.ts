import { compareCodeUnits } from './compare.js';
import { scanSource } from './source-scan.js';
import type {
  AnalyzeMessageUsageOptions,
  MessageUsageAnalysis,
  SourceFile,
  SourceDiagnostic,
} from './source-types.js';

/**
 * Compares the message keys application source references with the keys a catalog defines.
 *
 * Pure and in memory: it takes keys and source text and returns plain data. It reads no file,
 * resolves no path, executes no code, and never throws for a syntax error — a file that does
 * not parse becomes a `source.parse-error` diagnostic and the other files are still analysed.
 *
 * Only calls it can prove belong to Etyma are considered: translators created by
 * `injectT()` / `injectI18n()` from `@etyma/angular`, `createAstroI18n()` from
 * `@etyma/astro` and `createTranslator()` from `@etyma/core`, followed through their import
 * bindings, aliases included. An unrelated `t()` is ignored, because a missed usage is a
 * limitation, while a wrongly attributed one is a lie.
 *
 * The result does not depend on the order of `keys` or `files`.
 */
export function analyzeMessageUsage(options: AnalyzeMessageUsageOptions): MessageUsageAnalysis {
  const collected = collectMessageUsage(options.files);
  return finalizeMessageUsage(options.keys, collected.references, collected.diagnostics);
}

/** Shared source-syntax frontend for the framework-specific analyzer; not a package export. */
export function collectMessageUsage(
  files: readonly SourceFile[],
  parsedFileForPath?: (path: string) => unknown,
): {
  readonly references: readonly MessageUsageReference[];
  readonly diagnostics: readonly SourceDiagnostic[];
} {
  const references: MessageUsageReference[] = [];
  const diagnostics: SourceDiagnostic[] = [];

  for (const { path, source } of files) {
    const scan = scanSource(path, source, parsedFileForPath?.(path));

    for (const problem of scan.parseProblems) {
      diagnostics.push({
        code: 'source.parse-error',
        severity: 'error',
        path,
        line: problem.line,
        column: problem.column,
        message: problem.message,
      });
    }

    references.push(...scan.references.map(reference => ({ path, ...reference })));
  }

  return { references, diagnostics };
}

/** Plain semantic reference shared by syntax-specific analyzers. */
export interface MessageUsageReference {
  readonly path: string;
  readonly key: string | undefined;
  readonly line: number;
  readonly column: number;
}

/**
 * The one catalog lookup, deduplication, unreferenced and ordering path for every analyzer.
 * Kept as a tooling internal; syntax frontends feed it plain references and diagnostics.
 */
export function finalizeMessageUsage(
  keys: readonly string[],
  references: readonly MessageUsageReference[],
  initialDiagnostics: readonly SourceDiagnostic[] = [],
): MessageUsageAnalysis {
  const catalog = new Set(keys);
  const used = new Set<string>();
  const diagnostics = [...initialDiagnostics];

  for (const { path, key, line, column } of references) {
    if (key === undefined) {
      diagnostics.push({
        code: 'source.dynamic-key',
        severity: 'warning',
        path,
        line,
        column,
        message: 'The message key is not a string literal, so it cannot be checked statically.',
      });
    } else if (catalog.has(key)) {
      used.add(key);
    } else {
      diagnostics.push({
        code: 'source.unknown-key',
        severity: 'error',
        path,
        line,
        column,
        key,
        message: `The message key "${key}" is not defined in the catalog.`,
      });
    }
  }

  return {
    used: [...used].sort(compareCodeUnits),
    unreferenced: [...catalog].filter(key => !used.has(key)).sort(compareCodeUnits),
    diagnostics: diagnostics.sort(compareDiagnostics),
  };
}

function compareDiagnostics(a: SourceDiagnostic, b: SourceDiagnostic): number {
  return (
    compareCodeUnits(a.path, b.path) ||
    a.line - b.line ||
    a.column - b.column ||
    compareCodeUnits(a.code, b.code) ||
    compareCodeUnits(a.key ?? '', b.key ?? '') ||
    compareCodeUnits(a.message, b.message)
  );
}
