import type { Locale, MessageSource } from '@etyma/core';

/**
 * How seriously a {@link CatalogDiagnostic} should be taken.
 *
 * `'error'` means the catalog contract is broken: a page would render a hole, a stale key,
 * or a message that fails to format. `'warning'` means something is worth a human's
 * attention but is not necessarily wrong — a best-effort signal such as a dropped type
 * annotation, where the specification does not require the two sides to agree.
 */
export type DiagnosticSeverity = 'error' | 'warning';

/**
 * One problem found while validating a catalog, or a catalog against its source contract.
 *
 * `code` is the machine-readable part of the contract: stable, namespaced, and never
 * carrying a dynamic value (a key or a locale goes in its own field, never interpolated into
 * the code). A CLI, an MCP tool or a CMS should be able to switch on `code` without parsing
 * `message`, which exists for a human and may change wording between versions.
 */
export interface CatalogDiagnostic {
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly locale?: Locale;
  /** The dotted message key the diagnostic is about, when it is about one message. */
  readonly key?: string;
  readonly message: string;
}

/**
 * The outcome of validating one catalog, or a set of catalogs against a source contract.
 *
 * `valid` is `true` exactly when `diagnostics` contains no `'error'`-severity entry — a
 * warning alone does not fail validation. `diagnostics` is sorted deterministically (by
 * locale, then key, then code) so the same input always produces the same output, which
 * matters for CI, snapshots and anything that diffs two runs.
 */
export interface CatalogValidationResult {
  readonly valid: boolean;
  readonly diagnostics: readonly CatalogDiagnostic[];
}

/** Input to {@link validateCatalog}: one catalog, checked on its own. */
export interface ValidateCatalogOptions {
  readonly locale: Locale;
  readonly catalog: MessageSource;
}

/**
 * Input to {@link validateCatalogs}: a source catalog and every locale's catalog, keyed by
 * locale.
 *
 * `sourceLocale` and `catalogs` are typed as optional, not required, on purpose: a missing
 * source locale or an empty catalog map is a configuration mistake a caller can make just as
 * easily as a catalog author can leave out a key, and it should come back as a diagnostic —
 * `config.no-source-locale` or `config.no-catalogs` — rather than a thrown exception or a
 * type error that tells a dynamic caller nothing about which check failed.
 */
export interface ValidateCatalogsOptions {
  readonly sourceLocale?: Locale;
  readonly catalogs?: Readonly<Record<Locale, MessageSource>>;
}
