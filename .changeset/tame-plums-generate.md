---
'@etyma/tooling': minor
---

Add remote message contract generation, for `@etyma/core`'s new `defineRemoteI18n` mode.

- `extractContractKeys(source)` / `renderContractModule(keys)` — exported from the main entry
  point, pure and Node-free like the rest of this package. Extraction reuses `@etyma/core`'s
  own `flattenMessages`, so a malformed remote catalog is rejected exactly the same way a
  malformed local one is. Rendering is byte-stable for a given key set — no timestamp, no
  random id, no machine-specific path — so the file it produces is safe to commit and diffs
  only when the remote catalog's keys actually change.
- `@etyma/tooling/vite` — a new subpath, kept separate from the main entry point because it's
  the one place in this package that touches the filesystem or the network. Exports
  `etymaRemoteContract({ source | load, output })`, a Vite plugin that generates the contract
  automatically as part of `vite dev` and `vite build`, before anything else needs the file.
  Fails loudly if the source is unreachable and no valid contract already exists; falls back
  to an existing one with a warning otherwise. Declared structurally rather than typed
  against `vite`'s own `Plugin` — this package still ships zero peer dependencies.
