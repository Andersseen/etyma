---
'@etyma/core': minor
---

`defineI18n` takes an optional `contract`, so a JSON source catalog can have typed `t()` params
too. Generate it from the same file with `etyma contract` (`@etyma/cli`) and pass it next to
`source`:

```ts
import en from './en.json';
import contract from './etyma.generated';

export const i18n = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source: en,
  contract,
  loaders,
});

t('welcome', { name: 'Ada' }); // ok
t('welcome'); // error: `name` is required
```

It is the same `MessageContract` `defineRemoteI18n` reads. `source` stays the runtime catalog
and fallback; the contract only adds types:

- **Params** for the keys it lists variables for, merged with any a `defineMessages()` literal
  already declares - a literal and a disagreeing contract both apply, so a stale contract is a
  compile error rather than a silent pass.
- **Exact keys.** `definition.keys` is typed by the contract's keys, which must be keys of
  the source type: an array from a `.json` import gets `'steps.0' | 'steps.1'` instead of
  `` `steps.${number}` ``.
- **Key drift fails at definition time.** If the contract's keys are not exactly the source's,
  `defineI18n` throws an `EtymaError` listing the keys each side lacks, sorted. Variables are
  not re-checked at runtime - that would mean parsing every message - so regenerate the
  contract whenever the source changes.

Without `contract`, nothing changes: typed keys, optional untyped params for a JSON source,
and literal params for `defineMessages()`. `I18nOptions` gains two defaulted type parameters,
`TKey` and `TParams`.
