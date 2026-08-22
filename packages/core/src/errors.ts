/**
 * The single error type Etyma throws.
 *
 * Configuration mistakes (an unknown source locale, a catalog with a duplicate key) are
 * programmer errors and are surfaced loudly at definition time. Runtime problems that a
 * visitor could hit — a missing message, an unparseable pattern — never throw: a page that
 * renders the key beats a page that renders a stack trace.
 */
export class EtymaError extends Error {
  override readonly name = 'EtymaError';
}
