// The routing, catalog server and Vite plugins live in the shared consumer, copied into
// `src/` by `tools/scripts/compat-check.mjs`, so every Astro major builds the same site.
export { default } from './src/astro.config.shared.mjs';
