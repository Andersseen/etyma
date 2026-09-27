import { EtymaError } from './errors.js';

/**
 * A catalog as an author writes it: nested objects whose leaves are strings, or non-empty
 * arrays of strings.
 *
 * This is the shape of a `.json` file and the shape {@link defineMessages} takes, so the
 * two authoring styles converge before anything else in Etyma sees them. The root is always
 * an object.
 */
export interface MessageSource {
  readonly [key: string]: MessageValue;
}

/**
 * One value in a {@link MessageSource}: a message, a nested namespace, or a list of messages.
 *
 * An array is only a shorter way to write numbered keys - `{"steps": ["a", "b"]}` flattens
 * to `steps.0` and `steps.1`, exactly as `{"steps": {"0": "a", "1": "b"}}` would. It must be
 * non-empty and hold only strings; an array of objects or of arrays is not a catalog shape.
 */
export type MessageValue = string | MessageSource | readonly string[];

/**
 * A catalog as Etyma stores it: dotted key to MessageFormat 2 pattern.
 *
 * Flat because every lookup is by full key. Nested lookup would walk the tree on every
 * translated string on the page for no benefit, and would make a missing intermediate node
 * and a missing leaf two different failures.
 */
export type MessageCatalog = ReadonlyMap<string, string>;

/** One value substituted into a message's `{$placeholder}` slot. */
export type MessageParamValue = string | number | bigint | boolean | Date;

/** Values substituted into a message's `{$placeholder}` slots. */
export type MessageParams = Readonly<Record<string, MessageParamValue>>;

/**
 * The external variables of a MessageFormat 2 message, read from its literal type.
 *
 * Every `$name` a caller has to supply: placeholders (`{$name}`, `{$count :number}`),
 * `.input` declarations, and variable option values (`minimumFractionDigits=$digits`) -
 * minus the names a `.local` declaration defines inside the message. `never` for a message
 * with no variables, and for a plain `string`, whose text TypeScript does not know.
 *
 * A type-level reading, not the parser: it agrees with `messageformat` on well-formed
 * messages (`@etyma/tooling`'s tests check that against the real parser), and makes no claim
 * about malformed ones, which `@etyma/tooling` reports as `message.invalid-syntax`.
 */
export type MessageVariables<S extends string> = string extends S
  ? never
  : Exclude<ReferencedVariables<Unescape<S>>, LocalVariables<Unescape<S>>>;

/**
 * The params each message of a catalog shape needs, keyed by dotted message key.
 *
 * Only messages whose literal text declares at least one variable get an entry. A message
 * with no variables, and any message typed as plain `string` - every value in an imported
 * `.json` file, every message behind a remote contract - has none, and `t()` keeps taking
 * optional, untyped {@link MessageParams} for it.
 */
export type MessageParamsOf<T> = ParamMap<MessageParamEntry<T, ''>>;

/**
 * The upper bound of a key-to-params map such as {@link MessageParamsOf} produces. The
 * default, `Record<never, never>`, has no entries, so every key takes optional untyped params.
 */
export type MessageParamsMap = Readonly<Record<string, MessageParams>>;

/**
 * What `t()` takes after `key`: the exact params `TParams` records for that key, required,
 * or optional untyped {@link MessageParams} for a key it has no entry for.
 *
 * For a key typed as a union, the params every member with an entry needs, together - a
 * runtime key could be any of them, so satisfying only one is not enough. A `TParams` with an
 * index signature, such as {@link MessageParamsMap} itself, knows no particular key and is
 * untyped for all of them: that is what an injector hands back for `EtymaI18n` with no
 * definition to narrow it.
 */
export type MessageArgs<TParams, TKey extends string> = string extends keyof TParams
  ? [params?: MessageParams]
  : [Extract<TKey, keyof TParams>] extends [never]
    ? [params?: MessageParams]
    : [params: UnionToIntersection<TParams[Extract<TKey, keyof TParams>]>];

type UnionToIntersection<U> = (U extends unknown ? (union: U) => void : never) extends (
  intersection: infer I,
) => void
  ? I
  : never;

interface ParamEntryShape {
  readonly key: string;
  readonly variables: string;
}

type ParamMap<E extends ParamEntryShape> = {
  [X in E as X['key']]: Readonly<Record<X['variables'], MessageParamValue>>;
};

type MessageParamEntry<T, P extends string> = {
  [K in keyof T & string]: T[K] extends string
    ? ParamEntry<`${P}${K}`, T[K]>
    : T[K] extends readonly string[]
      ? {
          [I in Extract<keyof T[K], `${number}`>]: ParamEntry<`${P}${K}.${I}`, T[K][I]>;
        }[Extract<keyof T[K], `${number}`>]
      : MessageParamEntry<T[K], `${P}${K}.`>;
}[keyof T & string];

type ParamEntry<K extends string, S> = S extends string
  ? [MessageVariables<S>] extends [never]
    ? never
    : { readonly key: K; readonly variables: MessageVariables<S> }
  : never;

/** Drops escaped braces, so `\{$x}` is text rather than a placeholder. */
type Unescape<S extends string> = S extends `${infer A}\\{${infer B}` ? `${A}${Unescape<B>}` : S;

/**
 * Every `{...}` expression's variable, and every `$name` used as an option value. The `{{`
 * that opens a quoted pattern (`one {{{$count} item}}`) is stripped with the whitespace.
 */
type ReferencedVariables<S extends string> = S extends `${string}{${infer Body}}${infer Rest}`
  ? ExpressionVariables<Trim<Body>> | ReferencedVariables<Rest>
  : never;

type ExpressionVariables<B extends string> =
  (B extends `$${infer Name}` ? Word<Name> : never) | OptionVariables<NormalizeEquals<B>>;

type OptionVariables<B extends string> = B extends `${string}=$${infer Rest}`
  ? Word<Rest> | OptionVariables<Rest>
  : never;

/** Names bound by `.local $name = ...`, which the caller does not supply. */
type LocalVariables<S extends string> = S extends `${string}.local${infer Rest}`
  ? Trim<Rest> extends `$${infer Name}`
    ? Word<NormalizeEquals<Name>> | LocalVariables<Rest>
    : LocalVariables<Rest>
  : never;

/** A variable name ends at whitespace, `=`, `}` or `:`. */
type Word<S extends string> =
  S extends `${infer Head}${' ' | '\n' | '\t' | '=' | ':' | '}'}${string}` ? Word<Head> : S;

type NormalizeEquals<S extends string> = S extends `${infer A} =${infer B}`
  ? NormalizeEquals<`${A}=${B}`>
  : S extends `${infer A}= ${infer B}`
    ? NormalizeEquals<`${A}=${B}`>
    : S;

type Trim<S extends string> = S extends
  ` ${infer R}` | `\n${infer R}` | `\t${infer R}` | `{${infer R}`
  ? Trim<R>
  : S;

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
 *
 * An array contributes one key per index. A tuple type - what {@link defineMessages} infers
 * for an array literal - gives the exact indexes (`'steps.0' | 'steps.1'`). A plain
 * `string[]` - what TypeScript infers for an array in an imported `.json` file - has no
 * known length, so the honest key is `` `steps.${number}` ``: any index type-checks, and an
 * index past the end is a missing message at runtime, not a compile error.
 */
export type MessageKey<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : T[K] extends readonly string[]
          ? `${K}.${MessageIndex<T[K]>}`
          : `${K}.${MessageKey<T[K]>}`;
    }[keyof T & string];

/** The index keys of an array of messages: exact for a tuple, `${number}` otherwise. */
type MessageIndex<T extends readonly string[]> = number extends T['length']
  ? `${number}`
  : Extract<keyof T, `${number}`>;

/**
 * A message-key contract, independent of any translation values.
 *
 * `defineI18n`'s type-level contract comes from the shape of a static `source` object; this
 * is the alternative for a definition whose source catalog is itself only available at
 * runtime - see `defineRemoteI18n`. It carries `TKey` at the type level and, at runtime,
 * only the sorted list of keys, never a message.
 */
export interface MessageContract<TKey extends string = string> {
  readonly keys: readonly TKey[];
}

/**
 * Builds a {@link MessageContract} from a literal list of keys.
 *
 * Typically not written by hand: `@etyma/tooling`'s Vite plugin generates the call this
 * wraps from a remote catalog's shape, so the list is deterministic and sorted the same way
 * `defineI18n`'s own `keys` are. Written by hand it works the same way, for a definition
 * that would rather list its keys directly than derive them from an object shape.
 */
export function defineMessageContract<const TKeys extends readonly string[]>(
  keys: TKeys,
): MessageContract<TKeys[number]> {
  if (keys.length === 0) {
    throw new EtymaError('defineMessageContract: `keys` must list at least one key.');
  }

  const seen = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) {
      throw new EtymaError(`defineMessageContract: key "${key}" is listed twice.`);
    }

    seen.add(key);
  }

  return { keys: Object.freeze([...keys].sort()) };
}

/**
 * Flattens a nested catalog into dotted keys.
 *
 * An array of strings flattens to one key per zero-based index, in array order:
 * `{"steps": ["a", "b"]}` becomes `steps.0` and `steps.1`.
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
 * redundant with `path` alone, i.e. every kind except `'dotted-key'`, `'duplicate-key'` and
 * `'empty-array'`.
 *
 * An array element that is not a string - a number, an object, a nested array, or a hole in
 * a sparse array - is an `'invalid-leaf'` at the element's own indexed path (`steps.1`), not
 * at the array's. `'empty-array'` is an array with no elements at all, which would otherwise
 * contribute no key and vanish from the catalog contract without a trace.
 *
 * `'duplicate-key'` cannot occur from a plain nested object: segments may not contain `.`,
 * and an object cannot have two own properties with the same name at one level, so every
 * flattened path is already unique by construction. It is kept for structural completeness
 * with {@link flattenMessages}'s original behaviour and for callers that build a
 * {@link MessageSource} from something looser than object-literal JSON.
 */
export interface MessageSourceProblem {
  readonly path: string;
  readonly kind:
    'invalid-root' | 'empty-key' | 'dotted-key' | 'duplicate-key' | 'invalid-leaf' | 'empty-array';
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
      leaf(path, value, seen, onLeaf, onProblem);
      continue;
    }

    if (Array.isArray(value)) {
      walkArray(value, path, seen, onLeaf, onProblem);
      continue;
    }

    if (value === null || typeof value !== 'object') {
      onProblem({ path, kind: 'invalid-leaf', value });
      continue;
    }

    walk(value as MessageSource, `${path}.`, seen, onLeaf, onProblem);
  }
}

/**
 * Walks an array of messages by index, not with `forEach` or `entries`: a sparse array's
 * hole must be reported as the missing element it is, not skipped so that `[a, , c]` quietly
 * becomes keys `0` and `2`. A hole and an explicit `undefined` are the same invalid leaf.
 */
function walkArray(
  array: readonly unknown[],
  path: string,
  seen: Set<string>,
  onLeaf: (leaf: MessageSourceLeaf) => void,
  onProblem: (problem: MessageSourceProblem) => void,
): void {
  if (array.length === 0) {
    onProblem({ path, kind: 'empty-array' });
    return;
  }

  for (let index = 0; index < array.length; index++) {
    const value = array[index];
    const elementPath = `${path}.${index}`;

    if (typeof value === 'string') {
      leaf(elementPath, value, seen, onLeaf, onProblem);
    } else {
      onProblem({ path: elementPath, kind: 'invalid-leaf', value });
    }
  }
}

function leaf(
  path: string,
  value: string,
  seen: Set<string>,
  onLeaf: (leaf: MessageSourceLeaf) => void,
  onProblem: (problem: MessageSourceProblem) => void,
): void {
  if (seen.has(path)) {
    onProblem({ path, kind: 'duplicate-key' });
    return;
  }

  seen.add(path);
  onLeaf({ path, value });
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
          'message values must be strings, nested objects of messages, or non-empty arrays ' +
          'of strings, and array elements must be strings.',
      );
    case 'empty-array':
      return new EtymaError(
        `Invalid message catalog: "${problem.path}" is an empty array; ` +
          'an array of messages must contain at least one string.',
      );
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'an array';
  if (typeof value === 'object') return 'an object';

  return `a ${typeof value}`;
}
