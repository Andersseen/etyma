import { remoteCatalogs } from './catalogs.js';

/**
 * What `etymaRemoteContract` in `vite.config.ts` loads to derive the generated contract.
 *
 * A real application points this at a URL instead - `source: 'https://cdn.example.com/i18n/en.json'`.
 * This fixture uses a `load` callback pointed at a local module so contract generation stays
 * offline and deterministic here too, exactly like every other test in this milestone.
 */
export default remoteCatalogs.en;
