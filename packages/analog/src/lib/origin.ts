import { DOCUMENT, inject, isDevMode } from '@angular/core';
import { injectBaseURL } from '@analogjs/router/tokens';

/**
 * The absolute origin this application is being served from.
 *
 * Canonical and `hreflang` URLs have to be absolute to be worth anything, and the origin is
 * the one part of them the application cannot know statically: the same build serves
 * localhost, a preview deployment and production. Analog's `BASE_URL` carries the request's
 * own origin on the server; the browser reads its own location. Neither needs configuring,
 * which is why `origin` is an override rather than a required option.
 *
 * Must be called in an injection context.
 */
export function resolveOrigin(configured: string | undefined): string {
  if (configured !== undefined && configured.length > 0) {
    return withoutTrailingSlash(configured);
  }

  const fromRequest = injectBaseURL();

  if (fromRequest !== null && fromRequest.length > 0) {
    return withoutTrailingSlash(fromRequest);
  }

  const fromDocument = inject(DOCUMENT).defaultView?.location.origin;

  if (fromDocument !== undefined && fromDocument.length > 0 && fromDocument !== 'null') {
    return withoutTrailingSlash(fromDocument);
  }

  if (isDevMode()) {
    console.warn(
      '[etyma] Could not determine the request origin, so canonical and hreflang URLs will ' +
        'be relative. Pass `origin` to provideEtymaAnalog() if this render has no request.',
    );
  }

  return '';
}

function withoutTrailingSlash(origin: string): string {
  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
}
