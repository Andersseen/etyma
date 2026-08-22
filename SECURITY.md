# Security policy

## Supported versions

Etyma is pre-1.0. Only the latest published version receives fixes.

| Version        | Supported |
| -------------- | --------- |
| 0.0.x (latest) | Yes       |
| Anything older | No        |

## Reporting a vulnerability

Please report privately, through
[GitHub's private vulnerability reporting](https://github.com/Andersseen/etyma/security/advisories/new).
Do not open a public issue.

Include what you can: the affected package and version, what an attacker can do, and the
smallest reproduction you have. You should get an acknowledgement within a few days. If a
report is accepted, the fix and the advisory are published together.

## What is in scope

Etyma handles content that is often authored outside the codebase — translation catalogs
from a translator, a CMS or a pull request from a contributor. The interesting questions are
about that boundary:

- A catalog value being interpreted as markup or as code
- A locale from a URL reaching somewhere it should not
- Server-rendered state from one request appearing in another
- A message pattern causing unbounded work while formatting

## Design decisions that exist for this reason

- **A translation is text.** `t()` returns a string that is rendered as text. Nothing in the
  normal path assigns `innerHTML`, and a lint rule fails the build if anything starts to.
  Messages that need structure are returned as MessageFormat 2 parts.
- **No module-level mutable state.** Every piece of per-request state lives on an instance
  created per application injector, which on a server is per request. Two requests rendering
  two languages at the same moment share nothing.
- **Formatting never throws.** A malformed pattern renders as its own source and is reported;
  it cannot take down a page or leak a stack trace.
- **The locale is validated against the configured set**, not taken from the URL as-is.

## Supply chain

- One runtime dependency in `@etyma/core` ([`messageformat`](https://messageformat.github.io/),
  the MessageFormat 2 reference implementation), plus `tslib` in the Angular packages.
  Everything else is a peer dependency or dev-only.
- Every publish is provenance-attested.
- Publishing runs from a protected GitHub environment. After `0.0.1`, releases use npm
  Trusted Publishing (OIDC) and the bootstrap token is revoked — see
  [RELEASING.md](RELEASING.md).
- Third-party GitHub Actions are pinned to the commit each release tag pointed at, with the
  human-readable version in a trailing comment. Dependabot updates both.
