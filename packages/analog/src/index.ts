/**
 * AnalogJS integration for Etyma.
 *
 * The URL is the source of truth for the locale. Everything here follows from that: routes
 * are served under both `/` and `/<locale>/`, the catalog is loaded during navigation so
 * the server's HTML is already translated, and the head describes whichever page the URL
 * currently names.
 *
 * @packageDocumentation
 */

export { withLocalizedRoutes, ETYMA_LOCALE_PARAM } from './lib/routes.js';
export { provideEtymaAnalog, type EtymaAnalogOptions } from './lib/provide.js';
