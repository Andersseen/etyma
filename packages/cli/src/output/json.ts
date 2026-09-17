import type { CatalogValidationResult } from '@etyma/tooling';

export interface JsonMeta {
  readonly directory: string;
  readonly sourceLocale: string;
  readonly locales: readonly string[];
  readonly messageCount: number;
}

/**
 * Renders a `CatalogValidationResult` as machine-readable JSON.
 *
 * `valid` and `diagnostics` are carried over unchanged - this is not a second diagnostic
 * contract, just `CatalogValidationResult` plus the execution metadata a CI job, an editor
 * or a future MCP tool needs and the result itself doesn't carry (which directory, which
 * source locale, how many catalogs and messages were checked). The caller (`bin.ts`) writes
 * this and nothing else to stdout in `--format json` mode; an operational error is reported
 * on stderr as plain text instead, never wrapped as JSON.
 */
export function formatJson(result: CatalogValidationResult, meta: JsonMeta): string {
  const payload = {
    valid: result.valid,
    diagnostics: result.diagnostics,
    meta: { command: 'validate' as const, ...meta },
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
