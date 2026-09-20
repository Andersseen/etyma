/**
 * Per-request timeout when `--timeout` is not given. Long enough for a cold CDN or a slow
 * CI runner, short enough that a dead translation host fails the job instead of hanging it.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** `setTimeout`'s own ceiling; anything above it would fire immediately, not later. */
const MAX_TIMEOUT_MS = 2_147_483_647;

const LOCALE_PLACEHOLDER = '{locale}';

/** A `--remote` / `--locales` / `--timeout` combination that cannot be used - nothing was fetched. */
export class RemoteConfigError extends Error {}

/** What `etyma validate --remote ...` was asked to do, exactly as typed. */
export interface RemoteConfigInput {
  readonly template: string;
  readonly locales: string | undefined;
  readonly sourceLocale: string;
  readonly timeout: string | undefined;
}

/** One catalog to fetch: a requested locale and the URL its `{locale}` template resolves to. */
export interface RemoteTarget {
  readonly locale: string;
  readonly url: string;
}

/** A validated remote request: safe to fetch, deterministic to iterate. */
export interface RemoteConfig {
  readonly template: string;
  readonly timeoutMs: number;
  /** Sorted by locale, like local discovery, so output never depends on argument order. */
  readonly targets: readonly RemoteTarget[];
}

/**
 * Checks the whole remote request before a single byte is fetched, and resolves the URL
 * template once per locale.
 *
 * Deliberately shallow about locales: the list must be non-empty and free of *literal*
 * duplicates (a repeated entry cannot be represented in the `catalogs` record
 * `validateCatalogs` takes, and would just fetch the same URL twice), and `--source` must be
 * one of them. Whether a tag is a well-formed BCP 47 tag, or collides with another once
 * canonicalized (`en-US` / `en-us`), is `@etyma/tooling`'s `config.invalid-locale` /
 * `config.duplicate-locale` - the same diagnostics local mode reports - not a second
 * validator here.
 *
 * `--remote` is limited to `http:` and `https:`, and may not embed credentials: this release
 * has no authenticated sources, and the URL is echoed in errors and JSON metadata, so a
 * `user:password@` prefix would print a secret.
 */
export function resolveRemoteConfig(input: RemoteConfigInput): RemoteConfig {
  if (!input.template.includes(LOCALE_PLACEHOLDER)) {
    throw new RemoteConfigError(
      `--remote must contain the "${LOCALE_PLACEHOLDER}" placeholder, e.g. ` +
        `"https://cdn.example.com/i18n/${LOCALE_PLACEHOLDER}.json". Got "${input.template}".`,
    );
  }

  const locales = parseLocales(input.locales);

  if (!locales.includes(input.sourceLocale)) {
    throw new RemoteConfigError(
      `Source locale "${input.sourceLocale}" is not in --locales (${locales.join(', ')}).`,
    );
  }

  const timeoutMs = parseTimeout(input.timeout);

  const targets = [...locales]
    .sort((a, b) => a.localeCompare(b))
    .map(locale => ({ locale, url: resolveUrl(input.template, locale) }));

  return { template: input.template, timeoutMs, targets };
}

function parseLocales(raw: string | undefined): string[] {
  if (raw === undefined) {
    throw new RemoteConfigError('Missing required option --locales <list> (needed with --remote).');
  }

  const locales = raw.split(',').map(locale => locale.trim());

  if (locales.every(locale => locale === '')) {
    throw new RemoteConfigError(
      '--locales is empty. Expected a comma-separated list, e.g. en,es,uk.',
    );
  }

  if (locales.includes('')) {
    throw new RemoteConfigError(`--locales "${raw}" contains an empty entry.`);
  }

  const duplicates = locales.filter((locale, index) => locales.indexOf(locale) !== index);

  if (duplicates.length > 0) {
    const unique = [...new Set(duplicates)].map(locale => `"${locale}"`).join(', ');
    throw new RemoteConfigError(`--locales lists ${unique} more than once.`);
  }

  return locales;
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }

  const timeoutMs = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;

  if (!(timeoutMs >= 1 && timeoutMs <= MAX_TIMEOUT_MS)) {
    throw new RemoteConfigError(
      `Invalid --timeout "${raw}". Expected a whole number of milliseconds between 1 and ${MAX_TIMEOUT_MS}.`,
    );
  }

  return timeoutMs;
}

/**
 * Substitutes `locale` into the template, percent-encoded so a hostile or mistyped tag such
 * as `../x` or `en?x=1` cannot change the URL's structure, then checks the result is an
 * ordinary public `http(s)` URL.
 */
function resolveUrl(template: string, locale: string): string {
  const resolved = template.replaceAll(LOCALE_PLACEHOLDER, encodeURIComponent(locale));

  let url: URL;

  try {
    url = new URL(resolved);
  } catch {
    throw new RemoteConfigError(`--remote is not a valid URL: "${template}".`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new RemoteConfigError(
      `--remote must be an http: or https: URL, not "${url.protocol}" (got "${template}").`,
    );
  }

  if (url.username !== '' || url.password !== '') {
    throw new RemoteConfigError(
      '--remote must not contain credentials (user:password@host). Authenticated catalog ' +
        'sources are not supported yet, and the URL is printed in errors and JSON output.',
    );
  }

  return resolved;
}

/** One target's parsed JSON, or the reason it could not be obtained. */
export interface RemoteCatalogResult {
  readonly locale: string;
  readonly url: string;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Fetches every target concurrently and parses each response as JSON.
 *
 * Like `readCatalogFiles`, a failure is reported per catalog in `error`, never thrown, so one
 * run lists every broken locale instead of stopping at the first. Results follow
 * `config.targets` order (`Promise.all` preserves it), not network completion order.
 *
 * Uses the platform `fetch` and nothing else, with no headers - the same request
 * `createHttpMessageLoader` makes at runtime, so validation sees what the application sees.
 * Each request carries its own `AbortSignal.timeout`, which also bounds a response body that
 * stalls after the headers arrive. The body is only ever parsed as JSON data: never
 * evaluated, never written to disk.
 */
export function fetchRemoteCatalogs(config: RemoteConfig): Promise<RemoteCatalogResult[]> {
  return Promise.all(config.targets.map(target => fetchCatalog(target, config.timeoutMs)));
}

async function fetchCatalog(target: RemoteTarget, timeoutMs: number): Promise<RemoteCatalogResult> {
  const { locale, url } = target;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });

    if (!response.ok) {
      // The body is usually an HTML error page nobody needs; release it without reading it.
      await response.body?.cancel().catch(() => undefined);

      const statusText = response.statusText === '' ? '' : ` ${response.statusText}`;
      return { locale, url, error: `HTTP ${response.status}${statusText}` };
    }

    const text = await response.text();

    try {
      return { locale, url, data: JSON.parse(text) as unknown };
    } catch {
      return { locale, url, error: describeParseFailure(text, response.headers) };
    }
  } catch (error) {
    return { locale, url, error: describeFetchFailure(error, timeoutMs) };
  }
}

/**
 * A fixed-shape description of a body that is not JSON.
 *
 * Deliberately not `JSON.parse`'s own message: V8 quotes a snippet of the input in it, which
 * is engine-specific and would echo response content - an HTML error page, say - into a CI
 * log. The content type and the body's first character carry the useful signal (`[text/html]`,
 * `starts with "<"` is a login or error page, not a catalog) without relaying any of it.
 */
function describeParseFailure(body: string, headers: Headers): string {
  const contentType = headers.get('content-type');
  const hint = contentType !== null && !contentType.includes('json') ? ` [${contentType}]` : '';
  const first = body.trimStart()[0];
  const shape = first === undefined ? 'empty body' : `starts with ${JSON.stringify(first)}`;

  return `response is not valid JSON${hint} (${shape})`;
}

function describeFetchFailure(error: unknown, timeoutMs: number): string {
  if (!(error instanceof Error)) {
    return `network error: ${String(error)}`;
  }

  if (error.name === 'TimeoutError') {
    return `timed out after ${timeoutMs}ms`;
  }

  // Node's fetch reports every transport failure as `TypeError: fetch failed`; the useful
  // part (ECONNREFUSED, ENOTFOUND, a TLS error) is its `cause`.
  const cause = error.cause;

  if (cause instanceof Error) {
    const code = (cause as { code?: unknown }).code;
    return `network error: ${cause.message || (typeof code === 'string' ? code : cause.name)}`;
  }

  return `network error: ${error.message}`;
}
