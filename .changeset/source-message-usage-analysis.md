---
'@etyma/tooling': minor
---

Add `@etyma/tooling/source`: static analysis of how JavaScript and TypeScript source uses
message keys.

```ts
import { analyzeMessageUsage } from '@etyma/tooling/source';

const { used, unreferenced, diagnostics } = analyzeMessageUsage({
  keys: ['nav.home', 'nav.docs'],
  files: [{ path: 'src/nav.ts', source }],
});
```

- Recognises `injectT()` and `injectI18n()` from `@etyma/angular`, `createAstroI18n()` from
  `@etyma/astro` and `createTranslator()` from `@etyma/core` by following import bindings,
  aliases included. An unrelated `t()` is never counted.
- `used` lists catalog keys referenced by a literal. A literal key the catalog lacks is a
  `source.unknown-key` error; a key that is not a literal is a `source.dynamic-key` warning; a
  syntax error is a `source.parse-error` rather than a thrown exception. Diagnostics carry
  `path`, `line` and `column`.
- `unreferenced` lists keys not observed being referenced. They are candidates, not proof a key
  is safe to delete: templates, wrappers and dataflow are not analysed in this first version.
- Pure and in memory, with deterministic output. It needs the TypeScript parser, so it is its
  own subpath and `typescript` is a new dependency; the main `@etyma/tooling` entry does not
  load it.

JS/TS only. Angular templates, `.astro` files, wrappers and an `etyma analyze` command are not
included.
