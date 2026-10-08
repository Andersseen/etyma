import type { DiagnosticSeverity } from './types.js';

/**
 * One source file, already in memory. Angular analysis also accepts HTML template files.
 *
 * `path` is an in-memory label. `analyzeMessageUsage` echoes it exactly and never opens or
 * resolves it; Angular analysis also uses it to associate a component's `templateUrl` with
 * another supplied file. Its extension picks the source parser mode (`.tsx`, `.jsx`, ...).
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
 * - `source.parse-error` — a source file or Angular template has a syntax error. An `'error'`:
 *   whatever it uses may be missing from the result.
 */
export type SourceDiagnosticCode =
  'source.unknown-key' | 'source.dynamic-key' | 'source.parse-error' | 'source.template-missing';

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
  /** The normalized in-memory path requested by a component's `templateUrl`. */
  readonly templatePath?: string;
  readonly message: string;
}

/**
 * The outcome of {@link analyzeMessageUsage}. Plain data: nothing in it refers to a parser.
 *
 * - `used` — catalog keys referenced by a literal in a recognised Etyma call, sorted.
 * - `unreferenced` — catalog keys that analysis did **not** observe being referenced,
 *   sorted. That is a list of candidates to look at, never proof a key is safe to delete:
 *   the analysis is deliberately conservative and misses wrappers, translators passed as
 *   props, keys built at runtime and Angular template bindings it cannot prove.
 * - `diagnostics` — sorted by path, line, column, code, key, then message.
 */
export interface MessageUsageAnalysis {
  readonly used: readonly string[];
  readonly unreferenced: readonly string[];
  readonly diagnostics: readonly SourceDiagnostic[];
}
