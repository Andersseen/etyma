---
'@etyma/core': minor
---

Catalogs can now contain arrays of strings. Each element is an ordinary message, keyed by its
zero-based index:

```json
{ "onboarding": { "steps": ["Create an account", "Choose {$plan}", "Invite your team"] } }
```

flattens to `onboarding.steps.0`, `onboarding.steps.1` and `onboarding.steps.2` - the same
catalog numbered object keys (`{"0": …, "1": …}`) give. Translation stays one key at a time,
`t('onboarding.steps.1', { plan: 'Pro' })`: there is no list-returning API. Fallback,
MessageFormat 2, catalog snapshots and remote contract drift all see plain indexed keys, with
no array-specific behaviour.

- `MessageSource` values are now `string | MessageSource | readonly string[]`, exported as
  `MessageValue`. Loaders, `MessageModule` and `createHttpMessageLoader` accept the new shape
  unchanged.
- `MessageKey` understands arrays. A tuple - what `defineMessages()` and `defineI18n()` infer
  for an array literal - gives exact keys (`'steps.0' | 'steps.1'`). An array from an imported
  `.json` file is typed `string[]` by TypeScript, with no known length, so its keys are
  `` `steps.${number}` ``: any index type-checks, and one past the end renders the
  missing-message fallback at runtime.
- An array must be non-empty and hold only strings. An empty array is reported as the new
  `MessageSourceProblem` kind `'empty-array'`; a non-string element - a number, an object, a
  nested array, or a hole in a sparse array - is an `'invalid-leaf'` at its own indexed path
  (`steps.1`). `flattenMessages` and `defineI18n` throw for either. A catalog root that is an
  array is still `'invalid-root'`.

Code that switches exhaustively over `MessageSourceProblem['kind']` needs a case for
`'empty-array'`.
