---
'@etyma/core': minor
'@etyma/angular': minor
'@etyma/astro': minor
---

`t()` now checks params for messages whose text TypeScript knows. For a source catalog
written with `defineMessages()` - or as an object literal passed to `defineI18n` - each
message's MessageFormat 2 variables are read from its literal type, and `t()` requires
exactly those:

```ts
const source = defineMessages({ welcome: 'Hello, {$name}!', nav: { docs: 'Docs' } });

t('welcome', { name: 'Ada' }); // ok
t('welcome'); // error: `name` is required
t('welcome', { nmae: 'Ada' }); // error
t('nav.docs'); // ok: no variables, params stay optional
```

Placeholders, `.input` declarations and variable option values (`=$digits`) count; names
bound by `.local` do not. Array elements are typed per index. A key typed as a union needs
the params of every member. Param values keep the existing `MessageParamValue` type.

Messages typed as plain `string` - every message in an imported `.json` file - keep optional,
untyped params unless a generated `MessageContract` lists their variables: `defineRemoteI18n`
and, optionally, `defineI18n` take one (see the contract changesets).

- `@etyma/core`: new types `MessageVariables`, `MessageParamsOf`, `MessageArgs`,
  `MessageParamsMap` and `MessageParamValue`. `I18nDefinition`, `Translator` and
  `createTranslator` take a second, defaulted type parameter, `TParams`; `defineI18n`
  infers it from `source`. The type-level reading is checked against the `messageformat`
  parser in `@etyma/tooling`'s tests.
- `@etyma/angular`: `EtymaI18n`, `TranslateFn`, `injectI18n` and `injectT` carry `TParams`,
  so strict templates check params too. New `PartsFn` type for `parts`.
- `@etyma/astro`: `AstroI18n` and `createAstroI18n` carry `TParams`.

This can surface new compile errors in code that calls `t()` on a `defineMessages()` message
without the params it declares. That call already rendered a `{$name}` fallback at runtime,
so the error points at an existing bug.
