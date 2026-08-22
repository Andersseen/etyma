/**
 * Angular bindings for Etyma.
 *
 * Signal-native, standalone, zoneless-first: no NgModule, no RxJS in the public API and no
 * dependency on Zone.js. The package still works inside a Zone-based application - it just
 * never needs one.
 *
 * @packageDocumentation
 */

export { EtymaI18n, type TranslateFn } from './lib/i18n.js';
export { provideEtyma, type EtymaOptions } from './lib/provide.js';
export { injectI18n, injectT } from './lib/inject.js';
export { ETYMA_DEFINITION, ETYMA_LOCALE_SWITCH } from './lib/tokens.js';
