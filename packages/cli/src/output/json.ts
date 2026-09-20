import type { CatalogValidationResult } from '@etyma/tooling';

interface CommonMeta {
  readonly sourceLocale: string;
  readonly locales: readonly string[];
  readonly messageCount: number;
}

/** Where the catalogs came from: a local directory, or a `{locale}` URL template. */
export type Origin =
  | { readonly mode: 'local'; readonly directory: string }
  | { readonly mode: 'remote'; readonly remote: string };

export type JsonMeta = CommonMeta & Origin;

/**
 * Renders a `CatalogValidationResult` as machine-readable JSON.
 *
 * `valid` and `diagnostics` are carried over unchanged - this is not a second diagnostic
 * contract, just `CatalogValidationResult` plus the execution metadata a CI job, an editor
 * or a future MCP tool needs and the result itself doesn't carry: the source locale, how
 * many catalogs and messages were checked, and where they came from. `mode` and `remote`
 * are additive - a local run's `meta` is what 0.1 emitted plus `mode: "local"` - and
 * `remote` is the URL template as typed, which `resolveRemoteConfig` guarantees carries no
 * credentials. The caller (`bin.ts`) writes this and nothing else to stdout in
 * `--format json` mode; an operational error is reported on stderr as plain text instead,
 * never wrapped as JSON.
 */
export function formatJson(result: CatalogValidationResult, meta: JsonMeta): string {
  const payload = {
    valid: result.valid,
    diagnostics: result.diagnostics,
    meta: { command: 'validate' as const, ...meta },
  };

  return `${JSON.stringify(payload, null, 2)}\n`;
}
