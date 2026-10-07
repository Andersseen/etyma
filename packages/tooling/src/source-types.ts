import type { DiagnosticSeverity } from './types.js';

/**
 * One JavaScript or TypeScript file, already in memory.
 *
 * `path` is a label and nothing else: it is echoed back on diagnostics exactly as supplied
 * and never opened, normalised or resolved. Its extension picks the parser mode (`.tsx`,
 * `.jsx`, ...); see {@link analyzeMessageUsage}.
 */
export interface SourceFile {
  readonly path: string;
  readonly source: string;
}

/** Input to {@link analyzeMessageUsage}. */
export interface AnalyzeMessageUsageOptions {
  /** Every message key the catalog defines, for example from `extractContractKeys()`. */
  readonly keys: readonly string[];
  readonly files: readonly SourceFile[];
}

/**
 * What kind of finding a {@link SourceDiagnostic} is. Stable and namespaced, like
 * `CatalogDiagnostic.code`: switch on it, never on `message`.
 *
 * - `source.unknown-key` — a recognised Etyma call passes a literal key the catalog does not
 *   define. An `'error'`: the call is provably wrong.
 * - `source.dynamic-key` — a recognised Etyma call passes a key that is not a string
 *   literal, so its value cannot be known statically. A `'warning'`: dynamic keys are
 *   legitimate, the analysis just cannot follow them.
 * - `source.parse-error` — the file has a syntax error. An `'error'`: whatever the file
 *   uses may be missing from the result.
 */
export type SourceDiagnosticCode =
  'source.unknown-key' | 'source.dynamic-key' | 'source.parse-error';

/**
 * One finding in one source file.
 *
 * `line` and `column` are 1-based, and `column` counts UTF-16 code units, like an editor or
 * the TypeScript compiler. For a key finding they point at the key argument, not at the
 * call. `message` is for a human and may change wording between versions.
 */
export interface SourceDiagnostic {
  readonly code: SourceDiagnosticCode;
  readonly severity: DiagnosticSeverity;
  readonly path: string;
  readonly line: number;
  readonly column: number;
  /** The literal key, for `source.unknown-key`. */
  readonly key?: string;
  readonly message: string;
}

/**
 * The outcome of {@link analyzeMessageUsage}. Plain data: nothing in it refers to a parser.
 *
 * - `used` — catalog keys referenced by a literal in a recognised Etyma call, sorted.
 * - `unreferenced` — catalog keys that analysis did **not** observe being referenced,
 *   sorted. That is a list of candidates to look at, never proof a key is safe to delete:
 *   the analysis is deliberately conservative and misses wrappers, translators passed as
 *   props, keys built at runtime and templates.
 * - `diagnostics` — sorted by path, line, column, code, key, then message.
 */
export interface MessageUsageAnalysis {
  readonly used: readonly string[];
  readonly unreferenced: readonly string[];
  readonly diagnostics: readonly SourceDiagnostic[];
}
