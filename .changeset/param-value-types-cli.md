---
'@etyma/cli': patch
---

`etyma contract` writes the functions each variable's value reaches as a third
`defineMessageContract` argument, so `defineI18n({ source, contract })` narrows param values
(`{$year :number}` → `number | bigint | string`) the way a `defineMessages()` source does. No new
flag; regenerate and commit the contract. Still strict: invalid MessageFormat 2 writes nothing.
