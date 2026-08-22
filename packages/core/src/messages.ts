import { EtymaError } from './errors.js';

/**
 * A catalog as an author writes it: nested objects of strings.
 *
 * This is the shape of a `.json` file and the shape {@link defineMessages} takes, so the
 * two authoring styles converge before anything else in Etyma sees them.
 */
export interface MessageSource {
  readonly [key: string]: string | MessageSource;
}

/**
 * A catalog as Etyma stores it: dotted key to MessageFormat 2 pattern.
 *
 * Flat because every lookup is by full key. Nested lookup would walk the tree on every
 * translated string on the page for no benefit, and would make a missing intermediate node
 * and a missing leaf two different failures.
 */
export type MessageCatalog = ReadonlyMap<string, string>;

/** Values substituted into a message's `{$placeholder}` slots. */
export type MessageParams = Readonly<Record<string, string | number | bigint | boolean | Date>>;

/**
 * Authors a catalog in TypeScript instead of JSON.
 *
 * Purely an authoring convenience: the object it returns is the object it was given, and
 * it normalises to the same {@link MessageCatalog} a JSON file does. It exists so the
 * source catalog can live next to code and be assembled from parts, not to create a second
 * runtime — there is only one.
 */
export function defineMessages<const T extends MessageSource>(messages: T): T {
  return messages;
}

/**
 * Every dotted key in a catalog shape, as a string literal union.
 *
 * This is what makes `t('footer.rights')` compile and `t('footer.foo')` not. It reads the
 * source catalog's type, so the source language is the key contract and a translation that
 * has drifted cannot widen it.
 */
export type MessageKey<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${MessageKey<T[K]>}`;
    }[keyof T & string];

/**
 * Flattens a nested catalog into dotted keys.
 *
 * Rejects a key that already contains a dot, because `{"a.b": "x"}` and `{"a": {"b": "x"}}`
 * would otherwise produce the same flat key and one would silently win.
 */
export function flattenMessages(source: MessageSource): MessageCatalog {
  const catalog = new Map<string, string>();

  visit(source, '', catalog);

  return catalog;
}

function visit(node: MessageSource, prefix: string, out: Map<string, string>): void {
  for (const [segment, value] of Object.entries<unknown>(node)) {
    if (segment.length === 0) {
      throw new EtymaError(
        `Invalid message catalog: empty key${prefix ? ` under "${prefix.slice(0, -1)}"` : ''}.`,
      );
    }

    if (segment.includes('.')) {
      throw new EtymaError(
        `Invalid message catalog: key "${prefix}${segment}" contains a "."; ` +
          'dots separate nesting levels and cannot appear inside a key.',
      );
    }

    const key = `${prefix}${segment}`;

    if (typeof value === 'string') {
      if (out.has(key)) {
        throw new EtymaError(`Invalid message catalog: duplicate key "${key}".`);
      }

      out.set(key, value);
      continue;
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new EtymaError(
        `Invalid message catalog: "${key}" is ${describe(value)}; ` +
          'message values must be strings or nested objects of strings.',
      );
    }

    visit(value as MessageSource, `${key}.`, out);
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';

  return `a ${typeof value}`;
}
