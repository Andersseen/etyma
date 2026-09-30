---
'@etyma/cli': minor
---

New `etyma contract <source.json> --output <file> --check` verifies a committed contract
without writing anything - no file, directory, timestamp or cache. It renders the module
exactly as the normal command does and compares it byte for byte with `<file>`:

- `0` - the contract is up to date (same `✓ … is up to date` line as before);
- `1` - it is missing or out of date, with the command that regenerates it;
- `2` - usage, source (malformed JSON, invalid catalog shape, invalid MessageFormat 2) or
  filesystem error, including an output that exists but cannot be read.

This catches the drift `defineI18n` cannot see at runtime because the keys did not change: a
renamed variable (`{$name}` → `{$user}`), a changed, added or removed function annotation
(`{$count :number}` → `{$count :datetime}`, even `:number` → `:integer`), or array metadata. Run
it in CI next to `etyma validate`. Without `--check`, the command behaves exactly as before.

`etyma contract --help` now also documents that the contract carries MF2 function metadata.
