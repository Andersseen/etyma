/**
 * Brings in the ambient `astro:i18n`, `astro:config/*` and other virtual-module
 * declarations, plus `AstroGlobal`/`APIContext`, from Astro's own `astro/client` types.
 *
 * Global augmentation only - nothing here is exported. A consuming application gets these
 * declarations from its own Astro project setup and does not need this file; it exists so
 * this package's own source can typecheck and build against Astro's public surface.
 */
/// <reference types="astro/client" />
