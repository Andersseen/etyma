import { EtymaError, flattenMessages, type MessageSource } from '@etyma/core';

import { analyzeMessage } from './message-analysis.js';

/**
 * Extracts a message catalog's key contract, deterministically sorted.
 *
 * Built on `@etyma/core`'s own `flattenMessages` rather than a second catalog walker: the
 * same validation a static `source` catalog gets - no dotted or duplicate keys, every leaf a
 * string or a non-empty array of strings - applies here too, and throws the same way, whether
 * the catalog is a local file or a remote one.
 *
 * Only the keys are kept. The message values themselves are never part of a generated
 * contract - the source catalog stays the one place translation content lives.
 */
export function extractContractKeys(source: MessageSource): readonly string[] {
  return [...flattenMessages(source).keys()].sort();
}

/** Options for {@link extractContractVariables} and {@link extractContractParams}. */
export interface ExtractContractVariablesOptions {
  /**
   * Throw for a message that is not valid MessageFormat 2 syntax, naming every such key,
   * instead of leaving it out. Off by default: `etymaRemoteContract` leaves reporting to
   * `etymaRemoteValidation`; `etyma contract`, asked explicitly to describe one catalog, sets
   * it.
   */
  readonly strict?: boolean;
}

/**
 * What {@link extractContractParams} reads from a catalog: the two optional fields of a
 * contract after its keys, as `renderContractModule` and `defineMessageContract` take them.
 */
export interface ContractParams {
  /** Each message's external variables, sorted - as {@link extractContractVariables}. */
  readonly variables: Readonly<Record<string, readonly string[]>>;

  /**
   * For each message, the variables whose value reaches a `:function`, and the sorted raw
   * names of those functions. Only messages and variables with any get an entry.
   */
  readonly functions: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

/**
 * Extracts each message's external MessageFormat 2 variables, for a contract that types
 * `t()`'s params as well as its keys.
 *
 * Read with the `messageformat` parser, through the same analysis `validateCatalogs` compares
 * variables with - never a regex. Only messages with at least one variable get an entry, and
 * both keys and names are sorted, so the result is deterministic. A message that is not valid
 * MessageFormat 2 syntax has no knowable variables: by default it gets no entry, and so keeps
 * untyped params, leaving the syntax error to validation; with `strict` it throws. A message
 * that parses but breaks a data-model rule (a missing fallback variant, say) still has exact
 * variables and gets its entry either way - `validateCatalog` reports those.
 *
 * Throws on a malformed catalog shape exactly as {@link extractContractKeys} does. The
 * `variables` half of {@link extractContractParams}, which reads both from one parse.
 */
export function extractContractVariables(
  source: MessageSource,
  options: ExtractContractVariablesOptions = {},
): Readonly<Record<string, readonly string[]>> {
  return extractContractParams(source, options).variables;
}

/**
 * Extracts each message's external variables and, for each variable, the MessageFormat 2
 * functions its value is passed to - everything a generated contract needs to type `t()`'s
 * params by name and, where a built-in function proves it, by value. One parse per message.
 *
 * The functions are evidence, recorded by raw name: `@etyma/core` decides what they prove,
 * so a custom function or two disagreeing annotations are listed here and simply leave the
 * param broad there. An annotated `.input` declaration is its variable's only evidence,
 * because later uses see its resolved value rather than the caller's. A variable used only
 * bare, or only as an option value (`minimumFractionDigits=$digits`), has no entry.
 *
 * Invalid MessageFormat 2 is handled exactly as in {@link extractContractVariables}: left
 * out - no variables, no functions, nothing guessed - or, with `strict`, thrown.
 */
export function extractContractParams(
  source: MessageSource,
  options: ExtractContractVariablesOptions = {},
): ContractParams {
  const variables: Record<string, readonly string[]> = {};
  const functions: Record<string, Readonly<Record<string, readonly string[]>>> = {};
  const invalid: string[] = [];

  for (const [key, message] of [...flattenMessages(source)].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const analysis = analyzeMessage(message);
    const names = analysis.variables;

    if (names === undefined) {
      invalid.push(`  ${key}: ${analysis.diagnostics[0]?.message ?? 'invalid syntax'}`);
      continue;
    }

    if (names.size > 0) {
      variables[key] = [...names].sort();
    }

    const annotated = [...analysis.parameterFunctions.keys()].sort();

    if (annotated.length > 0) {
      functions[key] = Object.fromEntries(
        annotated.map(name => [name, [...(analysis.parameterFunctions.get(name) ?? [])].sort()]),
      );
    }
  }

  if (options.strict === true && invalid.length > 0) {
    throw new EtymaError(
      `${invalid.length} source ${invalid.length === 1 ? 'message is' : 'messages are'} not ` +
        `valid MessageFormat 2, so ${invalid.length === 1 ? 'its' : 'their'} variables ` +
        `cannot be read:\n${invalid.join('\n')}`,
    );
  }

  return { variables, functions };
}

const GENERATED_HEADER = [
  '// Generated by Etyma from a source message catalog. Do not edit.',
  '// Regenerate it with `etyma contract` (local JSON) or etymaRemoteContract (remote catalog).',
].join('\n');

/** The input of {@link renderContractModule}: a catalog's keys, and optionally its params. */
export interface ContractModuleInput extends Partial<ContractParams> {
  readonly keys: readonly string[];
}

/**
 * Renders a {@link https://www.npmjs.com/package/@etyma/core `defineMessageContract`} module
 * from a key list and, optionally, each message's variables and the functions those
 * variables' values reach - the one artifact both `defineI18n({ contract })` and
 * `defineRemoteI18n` read. It imports only `@etyma/core`, and holds no message text.
 *
 * Takes the same fields `defineMessageContract` does, so the output of
 * {@link extractContractParams} spreads straight in:
 * `renderContractModule({ keys, ...extractContractParams(source) })`.
 *
 * Byte-stable for a given input: no timestamp, no random id, no machine-specific path -
 * running this twice against the same catalog produces the same file, so committing the
 * output never causes churn the catalog itself did not cause. An empty list - a message with
 * no variables, a variable with no functions - is left out, as is a field with nothing left
 * in it, because `defineMessageContract` accepts neither.
 */
export function renderContractModule(input: ContractModuleInput): string {
  const { keys, variables = {}, functions = {} } = input;
  const keyLiteral = [...keys]
    .sort()
    .map(key => `    ${JSON.stringify(key)},`)
    .join('\n');
  const variableLiteral = Object.keys(variables)
    .filter(key => (variables[key]?.length ?? 0) > 0)
    .sort()
    .map(key => `    ${JSON.stringify(key)}: ${nameList(variables[key])},`)
    .join('\n');
  const functionLiteral = Object.keys(functions)
    .sort()
    .flatMap(key => {
      const byVariable = functions[key] ?? {};
      const entries = Object.keys(byVariable)
        .filter(name => (byVariable[name]?.length ?? 0) > 0)
        .sort()
        .map(name => `${JSON.stringify(name)}: ${nameList(byVariable[name])}`);

      return entries.length > 0 ? [`    ${JSON.stringify(key)}: { ${entries.join(', ')} },`] : [];
    })
    .join('\n');

  return (
    `${GENERATED_HEADER}\n` +
    `\n` +
    `import { defineMessageContract } from '@etyma/core';\n` +
    `\n` +
    `export default defineMessageContract({\n` +
    `  keys: [\n${keyLiteral}\n  ],\n` +
    (variableLiteral.length > 0 ? `  variables: {\n${variableLiteral}\n  },\n` : '') +
    (functionLiteral.length > 0 ? `  functions: {\n${functionLiteral}\n  },\n` : '') +
    `});\n`
  );
}

function nameList(names: readonly string[] | undefined): string {
  return `[${[...(names ?? [])]
    .sort()
    .map(name => JSON.stringify(name))
    .join(', ')}]`;
}
