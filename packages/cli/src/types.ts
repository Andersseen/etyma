/** What every command boundary returns: text to write and an exit code to set. */
export interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/**
 * A parsed JSON catalog file, shaped like `@etyma/core`'s `MessageSource` structurally.
 *
 * Defined locally rather than imported from `@etyma/core` on purpose: `@etyma/cli` depends
 * on `@etyma/tooling` only, never on `@etyma/core` directly - see the package README's
 * dependency graph. The shapes are structurally identical, so `@etyma/tooling`'s functions
 * accept this without a cast at the call site.
 */
export interface CatalogSource {
  readonly [key: string]: string | CatalogSource;
}

/** Exit codes `etyma validate` (and the CLI boundary) may return. See the package README. */
export const EXIT_VALID = 0;
export const EXIT_VALIDATION_FAILED = 1;
export const EXIT_USAGE_ERROR = 2;
