---
'@etyma/core': minor
---

Add definition-first key utilities, so translation keys stored in metadata can be typed without
casts or a hand-maintained second union. All are derived from `typeof i18n`:

```ts
type NavigationKey = I18nKeysWithoutRequiredParams<typeof i18n>;

interface NavigationItem {
  readonly labelKey: NavigationKey;
}

t(item.labelKey); // compiles; a key that requires params is not assignable
```

- `I18nMessageKey<D>` — every known key.
- `I18nKeysRequiringParams<D>` — keys with an exact required-params entry.
- `I18nKeysWithoutRequiredParams<D>` — the complement, safe to call without an argument.
- `I18nMessageArgs<D, K>` — the argument tuple `t()` takes for a key.

Types only: no runtime, contract or `MessageArgs` behaviour changes. `t()` is not loosened.
