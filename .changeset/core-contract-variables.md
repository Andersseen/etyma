---
'@etyma/core': minor
---

Remote definitions can type `t()`'s params too. `defineMessageContract` takes an optional
second argument listing the external variables of the messages that have any:

```ts
defineMessageContract(['nav.docs', 'welcome'] as const, { welcome: ['name'] } as const);
```

`defineRemoteI18n` carries them to `t()` the way `defineI18n` does for a literal source:
`t('welcome')` without `{ name }` is a compile error, and keys with no listed variables keep
optional, untyped params. At runtime the contract gains a sorted, frozen `variables` record;
variables for a key the contract does not list, an empty list, or a repeated name throw.
A contract built with keys only is unchanged. New types: `MessageContractVariables`,
`MessageContractParams`; `MessageContract` and `RemoteI18nOptions` take a defaulted `TParams`.
