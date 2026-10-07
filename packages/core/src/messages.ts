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

/**
 * One value substituted into a message's `{$placeholder}` slot.
 *
 * Every param has this type unless its message proves a narrower one - see
 * {@link NumericMessageParam} and {@link DateTimeMessageParam}. A bare `{$name}`, `:string`,
 * a custom function, an option value (`minimumFractionDigits=$digits`) and annotations that
 * disagree all stay this broad.
 */
export type MessageParamValue = string | number | bigint | boolean | Date;

/**
 * What a param annotated with a built-in numeric function - `:number`, `:integer`, `:offset`,
 * `:currency`, `:percent`, `:unit` - accepts at compile time.
 *
 * A semantic contract, deliberately stricter than `messageformat`'s coercion. A string stays
 * in because the runtime reads one holding a JSON number (`'12'`); whether a given string
 * does is only known at runtime, which reports a `bad-operand` issue for `'hello'` - this is
 * a type, not a validator. A `Date` is left out although the runtime would unwrap it through
 * `valueOf()` and format its epoch milliseconds: that is never a meaningful number to show.
 */
export type NumericMessageParam = number | bigint | string;

/**
 * What a param annotated with a built-in date/time function - `:date`, `:time`,
 * `:datetime` - accepts at compile time: a `Date`, epoch milliseconds, or a string the
 * runtime passes to `new Date()`. As with {@link NumericMessageParam}, an unparseable string
 * type-checks and is reported at runtime.
 */
export type DateTimeMessageParam = Date | number | string;

/** Values substituted into a message's `{$placeholder}` slots. */
export type MessageParams = Readonly<Record<string, MessageParamValue>>;

/**
 * The built-in functions whose operand is a number. Internal: `format.spec.ts` checks this
 * list, and the values it accepts, against the installed `messageformat`.
 */
export type NumericMessageFunction =
  'number' | 'integer' | 'offset' | 'currency' | 'percent' | 'unit';

/** The built-in functions whose operand is a date. Internal, checked the same way. */
export type DateTimeMessageFunction = 'date' | 'time' | 'datetime';

/**
 * The param type the function annotations on one variable prove, from their names.
 *
 * No annotation (`never`) is {@link MessageParamValue}. Otherwise every annotation has to
 * fall in one category for the param to narrow: two numeric functions narrow it; a numeric
 * and a date/time one do not, and neither does `:string` - which stringifies anything - or a
 * function Etyma has no operand contract for, such as a custom one.
 */
export type MessageParamValueFor<F extends string> = [F] extends [never]
  ? MessageParamValue
  : CategoryValue<FunctionCategory<F>>;

type FunctionCategory<F extends string> = F extends NumericMessageFunction
  ? 'numeric'
  : F extends DateTimeMessageFunction
    ? 'datetime'
    : F extends 'string'
      ? 'string'
      : 'unknown';

// `[C] extends [UnionToIntersection<C>]` holds only for a single category.
type CategoryValue<C> = [C] extends [UnionToIntersection<C>]
  ? C extends 'numeric'
    ? NumericMessageParam
    : C extends 'datetime'
      ? DateTimeMessageParam
      : MessageParamValue
  : MessageParamValue;

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
 * `.json` file - has none, and `t()` keeps taking optional, untyped {@link MessageParams} for
 * it unless a {@link MessageContract} lists its variables.
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
export type MessageArgs<TParams, TKey extends string> = [RequiredParamKeys<TParams, TKey>] extends [
  never,
]
  ? [params?: MessageParams]
  : [params: UnionToIntersection<TParams[RequiredParamKeys<TParams, TKey>]>];

/**
 * The members of `TKey` that `TParams` has an exact entry for - the one place "this key is
 * known to need params" is decided, shared by {@link MessageArgs} and the definition-first key
 * utilities. A `TParams` with an index signature knows no particular key, so none qualify.
 *
 * Internal: not re-exported from the package entry point.
 */
export type RequiredParamKeys<TParams, TKey extends string> = string extends keyof TParams
  ? never
  : Extract<TKey, keyof TParams>;

type UnionToIntersection<U> = (U extends unknown ? (union: U) => void : never) extends (
  intersection: infer I,
) => void
  ? I
  : never;

interface ParamEntryShape {
  readonly key: string;
  readonly params: MessageParams;
}

type ParamMap<E extends ParamEntryShape> = {
  [X in E as X['key']]: X['params'];
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
    : { readonly key: K; readonly params: LiteralParams<Unescape<S>, MessageVariables<S>> }
  : never;

type LiteralParams<S extends string, V extends string> = {
  readonly [N in V]: MessageParamValueFor<ParamFunctions<S, N>>;
};

/**
 * The functions a caller's `$name` is passed to. An annotated `.input` declaration rebinds
 * the name, so every later use - annotated or bare - sees its resolved value, never the
 * caller's: the declaration is then the only evidence. Otherwise every annotation on the
 * variable's own placeholders and `.local` values; a bare use constrains nothing, and an
 * option value (`=$digits`) is not an operand at all.
 */
type ParamFunctions<S extends string, N extends string> = [
  Extract<InputAnnotations<Declarations<S>>, { readonly name: N }>,
] extends [never]
  ? Extract<Annotations<S>, { readonly name: N }>['fn']
  : Extract<InputAnnotations<Declarations<S>>, { readonly name: N }>['fn'];

/** A variable operand and the function annotating it, from one trimmed expression body. */
type Annotation<B extends string> = B extends `$${infer After}`
  ? After extends `${Word<After>}${infer Tail}`
    ? Trim<Tail> extends `:${infer Fn}`
      ? { readonly name: Word<After>; readonly fn: FunctionName<Fn> }
      : never
    : never
  : never;

/** Every `{$name :function ...}` expression, declarations and placeholders alike. */
type Annotations<S extends string> = S extends `${string}{${infer Body}}${infer Rest}`
  ? Annotation<Trim<Body>> | Annotations<Rest>
  : never;

/** Every annotated `.input {$name :function}` declaration. */
type InputAnnotations<S extends string> = S extends `${string}.input${infer Rest}`
  ? Annotation<Trim<Rest>> | InputAnnotations<Rest>
  : never;

/**
 * A complex message's declarations - the text before its first quoted pattern - so `.input`
 * written as text in a simple message or inside a variant is not read as a declaration.
 */
type Declarations<S extends string> =
  TrimSpace<S> extends `.${string}` ? (S extends `${infer D}{{${string}` ? D : S) : '';

/** A function name - `number`, or a namespaced `ns:fn` - ends at whitespace or `}`. */
type FunctionName<S extends string> = S extends `${infer Head}${
  ' ' | '\n' | '\t' | '\r' | '}'}${string}`
  ? FunctionName<Head>
  : S;

type TrimSpace<S extends string> = S extends ` ${infer R}` | `\n${infer R}` | `\t${infer R}`
  ? TrimSpace<R>
  : S;

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
 * describes a catalog without holding it. `defineRemoteI18n` needs one, since its source
 * catalog only exists at runtime; `defineI18n` takes one optionally, to type what a `.json`
 * import cannot - params, and exact array indexes. It carries `TKey` - and, when it lists
 * them, each message's MessageFormat 2 variables as `TParams` - at the type level and, at
 * runtime, only the sorted keys and variable names, never a message.
 */
export interface MessageContract<
  TKey extends string = string,
  TParams extends MessageParamsMap = Record<never, never>,
> {
  readonly keys: readonly TKey[];

  /**
   * Each message's external variables, sorted, for the keys that have any. Absent from a
   * contract built without them.
   */
  readonly variables?: Readonly<Record<string, readonly string[]>>;

  /**
   * For the variables that have any, the MessageFormat 2 functions the caller's value is
   * passed to, sorted - raw names, as the source message wrote them. Absent from a contract
   * built without them.
   */
  readonly functions?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;

  /** Type-only, like `I18nDefinition['messageParams']`: never set at runtime. */
  readonly messageParams?: TParams;
}

/**
 * The `variables` of a {@link defineMessageContract} input: for some of the contract's keys,
 * the external variables that message declares.
 */
// A mapped type rather than `Readonly<Partial<Record<...>>>`: with a generic `TKey` only the
// mapped form still accepts `defineMessageContract`'s `Record<never, never>` default.
// eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
export type MessageContractVariables<TKey extends string = string> = {
  readonly [K in TKey]?: readonly string[];
};

/**
 * The `functions` of a {@link defineMessageContract} input: for some of a key's variables,
 * the MessageFormat 2 functions its value is passed to, by raw name (`['number']`).
 *
 * Evidence, not a verdict - the names are what the source message wrote, and `@etyma/core`
 * decides what they prove: a known built-in narrows the param, anything else, or
 * annotations that disagree, leave it {@link MessageParamValue}.
 */
export type MessageContractFunctions<TVariables = MessageContractVariables> = {
  readonly [K in keyof TVariables]?: Readonly<
    Partial<Record<VariableName<TVariables[K]>, readonly string[]>>
  >;
};

/**
 * The params map a {@link MessageContractVariables} literal describes, with each value typed
 * by the {@link MessageContractFunctions} listed for it, and {@link MessageParamValue} when
 * there are none.
 */
export type MessageContractParams<TVariables, TFunctions = Record<never, never>> = {
  [
    K in keyof TVariables & string as TVariables[K] extends readonly [string, ...string[]]
      ? K
      : never
  ]: {
    readonly [V in VariableName<TVariables[K]>]: MessageParamValueFor<
      ContractFunctionName<TFunctions, K, V>
    >;
  };
};

type VariableName<T> = T extends readonly (infer N extends string)[] ? N : never;

type ContractFunctionName<F, K extends string, V extends string> = K extends keyof F
  ? V extends keyof F[K]
    ? VariableName<F[K][V]>
    : never
  : never;

/**
 * Builds a {@link MessageContract} from a literal description of a catalog: its `keys` and,
 * optionally, the external `variables` of the messages that have any and the `functions`
 * those variables' values reach.
 *
 * Typically not written by hand: `etyma contract` generates the call this wraps from a local
 * source `.json` file, and `@etyma/tooling`'s `etymaRemoteContract` Vite plugin from a remote
 * one, so every list is deterministic and sorted the same way `defineI18n`'s own `keys` are.
 * Written by hand it works the same way.
 *
 * With `variables`, `t()` requires exactly those params for those keys, the way it does for
 * a literal `defineI18n` source; every other key keeps optional, untyped params. With
 * `functions` too, a param whose functions are all built-in numeric ones is a
 * {@link NumericMessageParam}, all date/time ones a {@link DateTimeMessageParam}; a variable
 * with no functions listed, or any other combination, stays {@link MessageParamValue}.
 *
 * One object with named fields - the same three a {@link MessageContract} carries - so a
 * committed contract says what each list is, and a later kind of metadata is one more
 * optional field rather than another positional argument. At runtime a field this version
 * does not know is ignored, never an error; at compile time it is an excess property, which
 * names the field instead of failing somewhere less obvious.
 *
 * ```ts
 * defineMessageContract({
 *   keys: ['nav.docs', 'total', 'welcome'],
 *   variables: { total: ['count'], welcome: ['name'] },
 *   functions: { total: { count: ['number'] } },
 * });
 * ```
 */
export function defineMessageContract<
  const TKeys extends readonly string[],
  const TVariables extends MessageContractVariables<TKeys[number]> = Record<never, never>,
  const TFunctions extends MessageContractFunctions<TVariables> = Record<never, never>,
>(contract: {
  readonly keys: TKeys;
  readonly variables?: TVariables;
  readonly functions?: TFunctions;
}): MessageContract<TKeys[number], MessageContractParams<TVariables, TFunctions>> {
  // Checked as `unknown`: a JavaScript caller, or an older generated contract, is not bound
  // by the parameter type.
  const input: unknown = contract;

  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new EtymaError(
      'defineMessageContract: expected one object, `{ keys, variables?, functions? }`. ' +
        'A contract generated by an older Etyma passed `keys` as an array first argument - ' +
        'regenerate it (for example with `etyma contract`).',
    );
  }

  const { keys, variables, functions } = contract;

  const keyList: unknown = keys;

  if (!Array.isArray(keyList) || keys.length === 0) {
    throw new EtymaError('defineMessageContract: `keys` must list at least one key.');
  }

  const seen = new Set<string>();

  for (const key of keys) {
    if (seen.has(key)) {
      throw new EtymaError(`defineMessageContract: key "${key}" is listed twice.`);
    }

    seen.add(key);
  }

  const result: {
    keys: readonly TKeys[number][];
    variables?: Record<string, readonly string[]>;
    functions?: Record<string, Readonly<Record<string, readonly string[]>>>;
  } = { keys: Object.freeze([...keys].sort()) };

  if (variables !== undefined) {
    result.variables = Object.freeze(validateContractVariables(seen, variables));
  }

  if (functions !== undefined) {
    result.functions = Object.freeze(validateContractFunctions(result.variables ?? {}, functions));
  }

  return Object.freeze(result);
}

function validateContractFunctions(
  variables: Readonly<Record<string, readonly string[]>>,
  functions: MessageContractFunctions,
): Record<string, Readonly<Record<string, readonly string[]>>> {
  const validated: Record<string, Readonly<Record<string, readonly string[]>>> = {};

  for (const key of Object.keys(functions).sort()) {
    const known = variables[key];
    const byVariable: unknown = functions[key];

    if (known === undefined) {
      throw new EtymaError(
        `defineMessageContract: functions are listed for "${key}", which has no variables listed.`,
      );
    }

    if (
      byVariable === null ||
      typeof byVariable !== 'object' ||
      Array.isArray(byVariable) ||
      Object.keys(byVariable).length === 0
    ) {
      throw new EtymaError(
        `defineMessageContract: functions for "${key}" must be a non-empty object of variable ` +
          'names; leave a message without annotated variables out.',
      );
    }

    const entry: Record<string, readonly string[]> = {};

    for (const name of Object.keys(byVariable).sort()) {
      const names: unknown = (byVariable as Record<string, unknown>)[name];

      if (!known.includes(name)) {
        throw new EtymaError(
          `defineMessageContract: functions are listed for variable "${name}" of "${key}", ` +
            'which is not one of its variables.',
        );
      }

      if (!Array.isArray(names) || names.length === 0) {
        throw new EtymaError(
          `defineMessageContract: functions for "${key}" variable "${name}" must be a ` +
            'non-empty array of function names; leave an unannotated variable out.',
        );
      }

      const unique = new Set<string>();

      for (const fn of names) {
        if (typeof fn !== 'string' || fn.length === 0) {
          throw new EtymaError(
            `defineMessageContract: functions for "${key}" variable "${name}" must be ` +
              'non-empty strings.',
          );
        }

        if (unique.has(fn)) {
          throw new EtymaError(
            `defineMessageContract: function "${fn}" is listed twice for "${key}" variable "${name}".`,
          );
        }

        unique.add(fn);
      }

      entry[name] = Object.freeze([...unique].sort());
    }

    validated[key] = Object.freeze(entry);
  }

  return validated;
}

function validateContractVariables(
  keys: ReadonlySet<string>,
  variables: MessageContractVariables,
): Record<string, readonly string[]> {
  const validated: Record<string, readonly string[]> = {};

  for (const key of Object.keys(variables).sort()) {
    const names: unknown = variables[key];

    if (!keys.has(key)) {
      throw new EtymaError(
        `defineMessageContract: variables are listed for "${key}", which is not in \`keys\`.`,
      );
    }

    if (!Array.isArray(names) || names.length === 0) {
      throw new EtymaError(
        `defineMessageContract: variables for "${key}" must be a non-empty array of names; ` +
          'leave a message without variables out.',
      );
    }

    const unique = new Set<string>();

    for (const name of names) {
      if (typeof name !== 'string' || name.length === 0) {
        throw new EtymaError(
          `defineMessageContract: variables for "${key}" must be non-empty strings.`,
        );
      }

      if (unique.has(name)) {
        throw new EtymaError(
          `defineMessageContract: variable "${name}" is listed twice for "${key}".`,
        );
      }

      unique.add(name);
    }

    validated[key] = Object.freeze([...unique].sort());
  }

  return validated;
}

/**
 * Compares a contract's keys with a catalog's: `missing` are the contract keys the catalog
 * lacks, `extra` the catalog keys the contract does not declare. Both sorted.
 *
 * Internal: shared by `defineI18n`'s definition-time contract check and the catalog
 * registry's remote contract-drift report, which differ in what they do about a difference
 * (throw, or report once) but not in what a difference is.
 */
export function compareKeys(
  contractKeys: Iterable<string>,
  catalogKeys: Iterable<string>,
): { readonly missing: readonly string[]; readonly extra: readonly string[] } {
  const contract = new Set(contractKeys);
  const catalog = new Set(catalogKeys);

  return {
    missing: [...contract].filter(key => !catalog.has(key)).sort(),
    extra: [...catalog].filter(key => !contract.has(key)).sort(),
  };
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
