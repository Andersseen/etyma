/// <reference types="node" />

/**
 * Remote catalog acquisition for `@etyma/tooling/vite`'s `etymaRemoteValidation`.
 *
 * Internal: deliberately not exported from `index.ts` - whose promise is that validation never
 * touches a network - nor from any `exports` subpath. It is the same acquisition model
 * `@etyma/cli`'s `etyma validate --remote` implements (`packages/cli/src/io/remote-catalogs.ts`):
 * a `{locale}` URL template, public `http(s)` only, no credentials, one concurrent request per
 * locale with its own `AbortSignal.timeout`, and failure reasons that never quote a response
 * body. The two are kept behaviourally identical on purpose; a shared public subpath would be
 * a permanent API designed around one internal caller, so they are not yet one module. Keep
 * the error wording below in step with the CLI's.
 *
 * Only platform globals (`fetch`, `URL`, `AbortSignal`) are used - no Node built-in - and a
 * response is only ever parsed as JSON data: never evaluated, never written to disk.
 */

/**
 * Per-request timeout when none is configured. Long enough for a cold CDN or a slow CI
 * runner, short enough that a dead translation host fails the build instead of hanging it.
 */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** `setTimeout`'s own ceiling; anything above it would fire immediately, not later. */
export const MAX_TIMEOUT_MS = 2_147_483_647;

export const LOCALE_PLACEHOLDER = '{locale}';

/** One catalog to fetch: a requested locale and the URL its `{locale}` template resolves to. */
export interface RemoteTarget {
  readonly locale: string;
  readonly url: string;
}

/** One target's parsed JSON, or the reason it could not be obtained. */
export interface RemoteCatalogResult {
  readonly locale: string;
  readonly url: string;
  readonly data?: unknown;
  readonly error?: string;
}

/**
 * Substitutes `locale` into the template, percent-encoded so a hostile or mistyped tag such
 * as `../x` or `en?x=1` cannot change the URL's structure, then checks the result is an
 * ordinary public `http(s)` URL without embedded credentials.
 *
 * Returns the resolved URL, or the reason it cannot be used - a reason that never contains
 * the URL's credentials, since it is shown to a human.
 */
export function resolveTemplateUrl(
  template: string,
  locale: string,
): { readonly url: string } | { readonly error: string } {
  const resolved = template.replaceAll(LOCALE_PLACEHOLDER, encodeURIComponent(locale));

  let url: URL;

  try {
    url = new URL(resolved);
  } catch {
    return { error: `is not a valid URL: "${template}".` };
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return {
      error: `must be an http: or https: URL, not "${url.protocol}" (got "${template}").`,
    };
  }

  if (url.username !== '' || url.password !== '') {
    return {
      error:
        'must not contain credentials (user:password@host). Authenticated catalog sources ' +
        'are not supported yet, and the URL is printed in error messages.',
    };
  }

  return { url: resolved };
}

/**
 * Fetches every target concurrently and parses each response as JSON.
 *
 * A failure is reported per catalog in `error`, never thrown, so one run lists every broken
 * locale instead of stopping at the first. Results follow `targets` order (`Promise.all`
 * preserves it), not network completion order.
 *
 * A plain GET with no headers - the same request `createHttpMessageLoader` makes at runtime,
 * so validation sees what the application sees. Each request carries its own
 * `AbortSignal.timeout`, which also bounds a response body that stalls after the headers.
 */
export function fetchRemoteCatalogs(
  targets: readonly RemoteTarget[],
  timeoutMs: number,
): Promise<RemoteCatalogResult[]> {
  return Promise.all(targets.map(target => fetchCatalog(target, timeoutMs)));
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
 * would echo response content - an HTML error page, say - into a build log. The content type
 * and the body's first character carry the useful signal without relaying any of it.
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
