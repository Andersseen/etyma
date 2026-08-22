import { inject, isDevMode } from '@angular/core';
import { EtymaError, type I18nDefinition } from '@etyma/core';

import { EtymaI18n, type TranslateFn } from './i18n.js';
import { ETYMA_DEFINITION } from './tokens.js';

/**
 * The Etyma service, typed against a definition.
 *
 * Passing the definition is what makes `t()` reject a key the source catalog does not have.
 * It is a type-level argument - the instance comes from the injector either way - and it is
 * checked against the provided definition while developing so a mismatched import fails
 * where it is written rather than as a missing translation later.
 *
 * ```ts
 * export class Nav {
 *   protected readonly i18n = injectI18n(i18n);
 * }
 * ```
 *
 * Called with no argument it still works; keys are then plain strings.
 */
export function injectI18n<TKey extends string = string>(
  definition?: I18nDefinition<TKey>,
): EtymaI18n<TKey> {
  const instance = inject(EtymaI18n);

  if (isDevMode() && definition !== undefined && definition !== inject(ETYMA_DEFINITION)) {
    throw new EtymaError(
      'injectI18n() was given a different i18n definition than the one passed to ' +
        'provideEtyma(). An application has one definition; import it from one module.',
    );
  }

  return instance;
}

/**
 * Just the translate function, for a component that needs nothing else.
 *
 * ```ts
 * export class Footer {
 *   protected readonly t = injectT(i18n);
 * }
 * ```
 */
export function injectT<TKey extends string = string>(
  definition?: I18nDefinition<TKey>,
): TranslateFn<TKey> {
  return injectI18n(definition).t;
}
