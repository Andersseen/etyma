import type { MessageContractParams, MessageParamsOf } from '@etyma/core';
import { describe, expect, it } from 'vitest';

import { paramSamples } from './__fixtures__/param-samples.js';
import { analyzeMessage } from './message-analysis.js';

/**
 * The param-value half of the parity contract `message-variables-parity.spec.ts` sets up for
 * names, over the rows in `__fixtures__/param-samples.ts`. Three readings have to agree on
 * every row:
 *
 * - the `messageformat` parser: `analyzeMessage(...).parameterFunctions`, checked at runtime;
 * - `@etyma/core`'s type-level reading of the literal: `MessageParamsOf`;
 * - a contract carrying exactly the parser's evidence: `MessageContractParams`.
 *
 * The last two are compared by `Agrees` below, which fails `pnpm typecheck` for any row where
 * the literal and the contract would type `t()` differently. `contract-params.spec.ts`
 * closes the loop by compiling a real generated contract for these rows.
 */

type Sample = (typeof paramSamples)[number];

// Exact, readonly modifiers included - unlike mutual assignability.
type Equal<A, B> =
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

interface AsVariables<E> {
  m: [keyof E] extends [never] ? [] : TupleOf<E>;
}
type TupleOf<E> = [keyof E & string, ...(keyof E & string)[]];
interface AsFunctions<E> {
  m: { [K in keyof E as E[K] extends readonly [string, ...string[]] ? K : never]: E[K] };
}

type LiteralParams<M extends string> = MessageParamsOf<{ m: M }>;
type ContractParams<E> = MessageContractParams<AsVariables<E>, AsFunctions<E>>;

type Agrees<S extends Sample> = S extends readonly [infer M extends string, infer E]
  ? Equal<LiteralParams<M>, ContractParams<E>>
  : false;

// Compile-time half. `Agrees` distributes over the rows: one disagreeing row makes it
// `boolean`, and this type `never`.
const typesAgree: false extends Agrees<Sample> ? never : true = true;

describe('literal param value types agree with the MessageFormat 2 parser', () => {
  it.each(paramSamples)('%j', (source, expected) => {
    const analysis = analyzeMessage(source);
    const evidence = Object.fromEntries(
      [...(analysis.variables ?? [])].map(name => [
        name,
        [...(analysis.parameterFunctions.get(name) ?? [])].sort(),
      ]),
    );

    expect(analysis.variables).toBeDefined();
    expect(evidence).toEqual(expected);
    expect(typesAgree).toBe(true);
  });
});
