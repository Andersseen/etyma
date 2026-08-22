# Contributing to Etyma

Etyma is alpha software with a deliberately small API. The most valuable contribution right
now is being told that something is wrong — a bug, a confusing name, an API that does not
survive contact with a real application — while it is still cheap to change.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

You need Node >= 22.22 and pnpm 10. `corepack enable` picks up the version pinned in
`package.json`.

```sh
pnpm install
pnpm check          # formatting, lint, typecheck, unit tests, build
```

To see it running:

```sh
pnpm dev            # the playground at http://localhost:5173
```

The playground is a real Analog 2 application that consumes Etyma the way an external
application would. It is a test fixture, not a showcase — keep it minimal.

## Before opening a pull request

```sh
pnpm check          # the normal gates
pnpm package:check  # publint, are-the-types-wrong, tarball assertions
pnpm e2e            # Playwright, against the Cloudflare build under Wrangler
pnpm compat:check   # a clean Angular 21 and 22 build against packed tarballs
```

`compat:check` runs `npm install` in two fixtures outside the workspace and takes a couple
of minutes. CI runs all four, so it is fine to leave the slower two to CI while iterating.

Add a changeset for anything that changes a published package:

```sh
pnpm changeset
```

Describe the change in the words a consumer would use. The three packages share one version,
so a changeset for any of them releases all three.

## The rules that are not negotiable

These are enforced by lint rules, package manifests and CI, and a pull request that breaks
one will fail before a human reads it.

**The dependency direction is one-way.**

```
@etyma/core  →  @etyma/angular  →  @etyma/analog
```

`@etyma/core` imports no Angular, no Analog, no DOM API, no browser global and no Node
built-in. `@etyma/angular` knows nothing about Analog. If a change seems to need one of
those imports, the design is in the wrong layer.

**Server rendering is request-scoped.** No module-level mutable state, ever. A `let
currentLocale = 'en'` at module scope leaks between two requests rendering two languages at
the same moment, and no test in the repository would notice.

**A translation is text.** Nothing in the normal rendering path may go near `innerHTML`. A
message that needs structure comes back as MessageFormat 2 parts.

**Standards over invention.** Plural rules come from CLDR, formatting from `Intl`, syntax
from MessageFormat 2. If Etyma would have to invent a rule, that is a sign the feature
belongs somewhere else.

**No RxJS in a public API, and no dependency on Zone.js.** Both may be used internally where
Angular hands us one; neither may appear in a signature a consumer writes.

## Style

- Strict TypeScript, everywhere. `any` at a framework boundary is occasionally unavoidable —
  isolate it, explain why in a comment, and never let it reach a public signature.
- Tests describe behaviour. `translates in the locale that is active` is a test name;
  `calls createTranslator` is not.
- The public API stays small. A new export needs a reason beyond "it exists internally".
- No `utils.ts`, no `common.ts`, no base class without a strong reason.
- Comments explain _why_, in the places where the reason is not visible from the code. If a
  decision looks arbitrary, the comment is the part that stops someone undoing it.

## Where things live

```
packages/core        The portable engine
packages/angular     Signals, DI, transfer state
packages/analog      Routing, request-scoped SSR, localized head
apps/playground      A real consumer, used by the Playwright suite
tools/compat         Clean Angular 21 and 22 consumers of packed tarballs
tools/scripts        Package validation and compatibility runners
```

## Reporting a bug

Use the issue form. For anything about routing or server rendering, the exact URL matters —
locale bugs are almost always about a specific URL shape.

For a security problem, please follow [SECURITY.md](SECURITY.md) instead of opening an
issue.
