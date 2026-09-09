---
'@etyma/angular': patch
'@etyma/analog': patch
'@etyma/core': patch
---

Transfer the active SSR locale together with loaded catalogs so hydrated Angular and Analog apps start in the server-rendered locale without a source-locale flash or duplicate catalog import.
