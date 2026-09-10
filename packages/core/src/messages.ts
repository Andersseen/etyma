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
 * would otherwise produce the same flat key and one would silently win. Built on
 * {@link walkMessageSource}, and throws on the first problem the walk reports: a malformed
 * catalog is a configuration bug, and the useful moment to fail is definition time.
 */
export function flattenMessages(source: MessageSource): MessageCatalog {
  const catalog = new Map<string, string>();
  let error: EtymaError | undefined;

  walkMessageSource(
    source,
    leaf => {
      if (!error) catalog.set(leaf.path, leaf.value);
    },
    problem => {
      error ??= problemToError(problem);
    },
  );

  if (error) {
    throw error;
  }

  return catalog;
}

/** One leaf message found while walking a {@link MessageSource} tree. */
export interface MessageSourceLeaf {
  readonly path: string;
  readonly value: string;
}

/**
 * A node in a {@link MessageSource} tree that does not fit the expected shape.
 *
 * `'invalid-root'` describes the tree itself; every other kind names the offending node by
 * its dotted `path`. `value` carries the offending value for the kinds where it is not
 * redundant with `path` alone, i.e. every kind except `'dotted-key'` and `'duplicate-key'`.
 *
 * `'duplicate-key'` cannot occur from a plain nested object: segments may not contain `.`,
 * and an object cannot have two own properties with the same name at one level, so every
 * flattened path is already unique by construction. It is kept for structural completeness
 * with {@link flattenMessages}'s original behaviour and for callers that build a
 * {@link MessageSource} from something looser than object-literal JSON.
 */
export interface MessageSourceProblem {
  readonly path: string;
  readonly kind: 'invalid-root' | 'empty-key' | 'dotted-key' | 'duplicate-key' | 'invalid-leaf';
  readonly value?: unknown;
}

/**
 * Walks a {@link MessageSource} tree, reporting every leaf and every problem found.
 *
 * The one tree-walking primitive behind catalog flattening. {@link flattenMessages} uses it
 * and stops at the first problem; a tolerant caller — such as `@etyma/tooling`'s catalog
 * validator — can call it directly to collect every problem in one pass, without
 * re-implementing the traversal or its notion of what a valid catalog node looks like.
 *
 * Never throws, and never stops early: a node that does not fit the expected shape does not
 * stop its siblings, or the rest of the tree, from being visited.
 */
export function walkMessageSource(
  source: unknown,
  onLeaf: (leaf: MessageSourceLeaf) => void,
  onProblem: (problem: MessageSourceProblem) => void,
): void {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    onProblem({ path: '', kind: 'invalid-root', value: source });
    return;
  }

  walk(source as MessageSource, '', new Set<string>(), onLeaf, onProblem);
}

function walk(
  node: MessageSource,
  prefix: string,
  seen: Set<string>,
  onLeaf: (leaf: MessageSourceLeaf) => void,
  onProblem: (problem: MessageSourceProblem) => void,
): void {
  for (const [segment, value] of Object.entries<unknown>(node)) {
    if (segment.length === 0) {
      onProblem({ path: prefix, kind: 'empty-key' });
      continue;
    }

    if (segment.includes('.')) {
      onProblem({ path: `${prefix}${segment}`, kind: 'dotted-key' });
      continue;
    }

    const path = `${prefix}${segment}`;

    if (typeof value === 'string') {
      if (seen.has(path)) {
        onProblem({ path, kind: 'duplicate-key' });
        continue;
      }

      seen.add(path);
      onLeaf({ path, value });
      continue;
    }

    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      onProblem({ path, kind: 'invalid-leaf', value });
      continue;
    }

    walk(value as MessageSource, `${path}.`, seen, onLeaf, onProblem);
  }
}

function problemToError(problem: MessageSourceProblem): EtymaError {
  switch (problem.kind) {
    case 'invalid-root':
      return new EtymaError(
        `Invalid message catalog: root is ${describe(problem.value)}; ` +
          'expected an object of messages.',
      );
    case 'empty-key':
      return new EtymaError(
        `Invalid message catalog: empty key${problem.path ? ` under "${problem.path.slice(0, -1)}"` : ''}.`,
      );
    case 'dotted-key':
      return new EtymaError(
        `Invalid message catalog: key "${problem.path}" contains a "."; ` +
          'dots separate nesting levels and cannot appear inside a key.',
      );
    case 'duplicate-key':
      return new EtymaError(`Invalid message catalog: duplicate key "${problem.path}".`);
    case 'invalid-leaf':
      return new EtymaError(
        `Invalid message catalog: "${problem.path}" is ${describe(problem.value)}; ` +
          'message values must be strings or nested objects of strings.',
      );
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';

  return `a ${typeof value}`;
}
