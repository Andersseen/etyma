import { EtymaError, type MessageSource } from '@etyma/core';

import {
  DEFAULT_TIMEOUT_MS,
  fetchRemoteCatalogs,
  LOCALE_PLACEHOLDER,
  MAX_TIMEOUT_MS,
  type RemoteCatalogResult,
  type RemoteTarget,
  resolveTemplateUrl,
} from './remote-catalogs.js';
import type { CatalogDiagnostic, CatalogValidationResult } from './types.js';
import { validateCatalogs } from './validate-catalogs.js';

export interface EtymaRemoteValidationOptions {
  /**
   * A URL template containing `{locale}`, e.g. `https://cdn.example.com/i18n/{locale}.json`.
   * Public `http:` / `https:` only; credentials in the URL are rejected.
   */
  readonly remote: string;
  /** Every locale to fetch and validate, the source locale included. */
  readonly locales: readonly string[];
  /** The locale whose catalog is the contract every other locale is measured against. */
  readonly sourceLocale: string;
  /** Per-request timeout in milliseconds, covering a stalled body too. Defaults to 10 000. */
  readonly timeout?: number;
}

/**
 * The plugin `etymaRemoteValidation` returns - declared structurally, like
 * `EtymaContractPlugin`, so this package never imports `vite`.
 */
export interface EtymaRemoteValidationPlugin {
  readonly name: string;
  configResolved(config: {
    readonly command: 'build' | 'serve';
    readonly logger: { info(message: string): void; warn(message: string): void };
  }): void;
  buildStart(): Promise<void>;
}

/** At most this many diagnostics are listed per locale in one error; the rest are counted. */
const MAX_LISTED_PER_LOCALE = 20;

/**
 * Validates remote catalogs as part of `vite dev` and `vite build` (and so `astro dev` /
 * `astro build`): fetches every locale's catalog from a `{locale}` URL template and passes
 * them, unchanged, to the same `validateCatalogs()` the main entry point exports.
 *
 * An adapter, not a second validator: this checks only what it needs to fetch safely - the
 * template, a non-empty locale list without repeated entries, the source locale among them,
 * the timeout - and does so here, when the plugin is created, before any request is sent.
 * Locale well-formedness, canonical collisions, key parity, MessageFormat 2 and variable
 * parity are all `validateCatalogs()`'s diagnostics.
 *
 * Runs once per plugin instance - once per `vite build` / `astro build`, and once per dev
 * server start or config-triggered restart. Nothing is polled, watched or written to disk.
 *
 * During a build, a catalog that cannot be obtained (network error, timeout, HTTP error
 * status, a body that is not JSON) or one with an error diagnostic fails the build with one
 * summarised error. During `serve`, the same report is logged as a warning and the dev server
 * starts anyway: a translator's in-progress mistake or an offline laptop should not stop
 * local development, and the build still refuses to ship it.
 */
export function etymaRemoteValidation(
  options: EtymaRemoteValidationOptions,
): EtymaRemoteValidationPlugin {
  const request = resolveRequest(options);

  let command: 'build' | 'serve' = 'build';
  let logger: { info(message: string): void; warn(message: string): void } = console;
  let outcome: Promise<Outcome> | undefined;
  let reported = false;

  return {
    name: 'etyma-remote-validation',
    configResolved(config) {
      command = config.command;
      logger = config.logger;
    },
    async buildStart() {
      // Memoized per plugin instance, not per process: Astro runs several Vite builds (and
      // environments) with the same plugin objects, and one validation covers all of them.
      outcome ??= acquireAndValidate(request);
      const result = await outcome;

      // Decided per call, not memoized: a `serve` run that only warned must not let a
      // later `build` with the same plugin instance pass.
      if (result.failure !== undefined && command === 'build') {
        throw new EtymaError(result.failure);
      }

      if (reported) {
        return;
      }

      reported = true;

      if (result.failure !== undefined) {
        // Not "the dev server keeps running": `astro build` also runs a `serve`-mode Vite pass
        // (content sync) before its real build, which then fails on the same report.
        logger.warn(
          `${result.failure}\n\nA warning here because this is not a build; a build fails on it.`,
        );
      } else if (result.warnings !== undefined) {
        logger.warn(result.warnings);
      } else {
        logger.info(`[etyma] remote catalogs valid: ${request.locales.join(', ')}`);
      }
    },
  };
}

interface ResolvedRequest {
  readonly sourceLocale: string;
  /** Sorted, so fetching and reporting never depend on the order `locales` was written in. */
  readonly locales: readonly string[];
  readonly targets: readonly RemoteTarget[];
  readonly timeoutMs: number;
}

/** A failed run's full report, or a passing run's warnings, if it had any. */
interface Outcome {
  readonly failure?: string;
  readonly warnings?: string;
}

function resolveRequest(options: EtymaRemoteValidationOptions): ResolvedRequest {
  const { remote, locales, sourceLocale, timeout = DEFAULT_TIMEOUT_MS } = options;

  if (typeof remote !== 'string' || !remote.includes(LOCALE_PLACEHOLDER)) {
    throw configError(
      `\`remote\` must be a URL template containing "${LOCALE_PLACEHOLDER}", e.g. ` +
        `"https://cdn.example.com/i18n/${LOCALE_PLACEHOLDER}.json". Got ${JSON.stringify(remote)}.`,
    );
  }

  // Checked through `unknown`: `Array.isArray` would otherwise narrow `locales` to `any[]`.
  const list: unknown = locales;

  if (!Array.isArray(list)) {
    throw configError(
      "`locales` must be an array of locale strings, e.g. ['en', 'es', 'uk'] - not a " +
        'comma-separated string.',
    );
  }

  if (locales.length === 0) {
    throw configError('`locales` is empty. List every locale to validate, the source included.');
  }

  const invalid = locales.filter(locale => typeof locale !== 'string' || locale.trim() === '');

  if (invalid.length > 0) {
    throw configError(
      `\`locales\` contains an empty or non-string entry: ${JSON.stringify(locales)}.`,
    );
  }

  const duplicates = [
    ...new Set(locales.filter((locale, index) => locales.indexOf(locale) !== index)),
  ];

  if (duplicates.length > 0) {
    throw configError(
      `\`locales\` lists ${duplicates.map(locale => `"${locale}"`).join(', ')} more than once.`,
    );
  }

  if (typeof sourceLocale !== 'string' || !locales.includes(sourceLocale)) {
    throw configError(
      `\`sourceLocale\` ${JSON.stringify(sourceLocale)} is not in \`locales\` ` +
        `(${locales.join(', ')}).`,
    );
  }

  if (!Number.isInteger(timeout) || timeout < 1 || timeout > MAX_TIMEOUT_MS) {
    throw configError(
      `\`timeout\` must be a whole number of milliseconds between 1 and ${MAX_TIMEOUT_MS}. ` +
        `Got ${String(timeout)}.`,
    );
  }

  const sorted = [...locales].sort((a, b) => a.localeCompare(b));

  // Every URL is resolved and checked before the first request is sent.
  const targets = sorted.map(locale => {
    const resolved = resolveTemplateUrl(remote, locale);

    if ('error' in resolved) {
      throw configError(`\`remote\` ${resolved.error}`);
    }

    return { locale, url: resolved.url };
  });

  return { sourceLocale, locales: sorted, targets, timeoutMs: timeout };
}

function configError(message: string): EtymaError {
  return new EtymaError(`etymaRemoteValidation: ${message}`);
}

async function acquireAndValidate(request: ResolvedRequest): Promise<Outcome> {
  const fetched = await fetchRemoteCatalogs(request.targets, request.timeoutMs);
  const broken = fetched.filter(catalog => catalog.error !== undefined);

  // Validation cannot meaningfully run on a partial set: a missing catalog is not a
  // diagnostic, and validating the rest would report a misleadingly short list.
  if (broken.length > 0) {
    return { failure: formatAcquisitionFailure(broken, fetched.length) };
  }

  // `Object.fromEntries` defines own properties, so a locale spelled `__proto__` cannot
  // rewrite the record's prototype.
  const catalogs = Object.fromEntries(
    fetched.map(catalog => [catalog.locale, catalog.data as MessageSource]),
  );
  const result = validateCatalogs({ sourceLocale: request.sourceLocale, catalogs });

  if (!result.valid) {
    return {
      failure: formatDiagnostics('[etyma] remote catalog validation failed', result, request),
    };
  }

  if (result.diagnostics.length > 0) {
    return {
      warnings: formatDiagnostics('[etyma] remote catalogs are valid', result, request),
    };
  }

  return {};
}

function formatAcquisitionFailure(broken: readonly RemoteCatalogResult[], total: number): string {
  const lines = [
    `[etyma] could not load ${broken.length} of ${total} remote ${plural(total, 'catalog')}; ` +
      'nothing was validated',
  ];

  for (const catalog of broken) {
    lines.push('', `  ${catalog.locale.toUpperCase()}  ${catalog.url}`, `    ${catalog.error}`);
  }

  return lines.join('\n');
}

/**
 * Renders a result grouped by locale, in `validateCatalogs()`'s own deterministic order
 * (locale, then key, then code) - no second sort, no second diagnostic model.
 */
function formatDiagnostics(
  heading: string,
  result: CatalogValidationResult,
  request: ResolvedRequest,
): string {
  const errors = result.diagnostics.filter(diagnostic => diagnostic.severity === 'error').length;
  const warnings = result.diagnostics.length - errors;
  const counts = [
    ...(errors > 0 ? [`${errors} ${plural(errors, 'error')}`] : []),
    ...(warnings > 0 ? [`${warnings} ${plural(warnings, 'warning')}`] : []),
  ].join(', ');

  const lines = [`${heading}: ${counts}`];
  const urls = new Map(request.targets.map(target => [target.locale, target.url]));

  for (const [locale, diagnostics] of groupByLocale(result.diagnostics)) {
    const url = locale === undefined ? undefined : urls.get(locale);
    const label = locale === undefined ? '(all catalogs)' : locale.toUpperCase();

    lines.push('', url === undefined ? `  ${label}` : `  ${label}  ${url}`);

    for (const diagnostic of diagnostics.slice(0, MAX_LISTED_PER_LOCALE)) {
      const key = diagnostic.key === undefined ? '' : `  ${diagnostic.key}`;
      lines.push(
        `    ${diagnostic.severity} ${diagnostic.code}${key}`,
        `      ${diagnostic.message}`,
      );
    }

    if (diagnostics.length > MAX_LISTED_PER_LOCALE) {
      lines.push(`    ... and ${diagnostics.length - MAX_LISTED_PER_LOCALE} more`);
    }
  }

  return lines.join('\n');
}

function groupByLocale(
  diagnostics: readonly CatalogDiagnostic[],
): Map<string | undefined, CatalogDiagnostic[]> {
  const groups = new Map<string | undefined, CatalogDiagnostic[]>();

  for (const diagnostic of diagnostics) {
    const group = groups.get(diagnostic.locale) ?? [];
    group.push(diagnostic);
    groups.set(diagnostic.locale, group);
  }

  return groups;
}

function plural(count: number, word: string): string {
  return count === 1 ? word : `${word}s`;
}
