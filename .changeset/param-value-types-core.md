---
'@etyma/core': minor
---

`t()` and `parts()` now narrow a param's _value_ type when a built-in MessageFormat 2 function
proves it, from a literal `defineMessages()` source or a generated contract:

```ts
const source = defineMessages({ total: 'Total: {$count :number}', updated: '{$when :datetime}' });

t('total', { count: 12 }); // ok — also 12n or '12'
t('total', { count: new Date() }); // now a compile error
t('updated', { when: new Date() }); // ok — also epoch ms or a date string
```

- `:number`, `:integer`, `:offset`, `:currency`, `:percent` and `:unit` params are
  `NumericMessageParam` (`number | bigint | string`).
- `:date`, `:time` and `:datetime` params are `DateTimeMessageParam` (`Date | number | string`).
- A bare `{$name}`, `:string`, a custom function, a variable used only as an option value, and
  annotations that disagree all stay `MessageParamValue`. An annotated `.input` declaration types
  its variable; later uses do not change it.

The types are semantic, deliberately stricter than `messageformat`'s coercion: its numeric
functions would format a `Date` as epoch milliseconds, and Etyma rejects it. They are not a
runtime validator — `'hello'` still type-checks for `:number` and is reported through `onIssue`.
Runtime formatting is unchanged.

`defineMessageContract` takes an optional third argument, the functions each variable's value
reaches (`{ total: { count: ['number'] } }`), which `etyma contract` and `etymaRemoteContract`
now generate. It is validated and frozen like `variables`; the one- and two-argument forms keep
their meaning, and a contract without it types every listed param as `MessageParamValue`. When a
`defineMessages()` literal and its `contract` narrow the same param to different types, the param
becomes `never`, so the stale contract is a compile error. New exports: `NumericMessageParam`,
`DateTimeMessageParam`, `MessageContractFunctions`; `MessageContractParams` takes an optional
second type argument.

**Possibly breaking at compile time:** a call that passes, say, a `Date` or a boolean to a
`{$count :number}` param compiled before and fails now. That call never formatted as the message
intended; pass the value the annotation expects.
