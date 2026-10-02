---
'@etyma/core': minor
---

**Breaking:** `defineMessageContract` takes one object, `{ keys, variables?, functions? }`,
instead of three positional arguments - the same three fields a `MessageContract` carries.
A later kind of contract metadata becomes one more optional field rather than a fourth
argument, a committed contract says what each list is, and a field a version does not know is
ignored at runtime and named as an excess property at compile time.

Migrate by regenerating, not editing: `etyma contract` for a local source (`etyma contract
--check` reports a contract that still uses the old form), or the next `vite dev` / `vite build`
for `etymaRemoteContract`. A hand-written contract becomes:

```ts
// before
defineMessageContract(['nav.docs', 'welcome'] as const, { welcome: ['name'] } as const);
// after
defineMessageContract({ keys: ['nav.docs', 'welcome'], variables: { welcome: ['name'] } });
```

The old form now throws an `EtymaError` that says to regenerate.

**Breaking:** `toMessageSource` is no longer exported. It was an undocumented detail of
`loadMessageCatalog` - how a module namespace from a dynamic `import()` is unwrapped - and
`loadMessageCatalog` remains the public way to run a loader and normalize its result.

Merging a literal `defineMessages()` source's params with a contract's is now linear in the
number of keys instead of quadratic. An 836-key literal source with a contract used to fail
with TS2589 ("Type instantiation is excessively deep and possibly infinite"); a JSON source
with a contract type-checks with roughly 15x fewer type instantiations at that size.
