import type { MessageVariables } from '@etyma/core';
import { describe, expect, it } from 'vitest';

import { analyzeMessage } from './message-analysis.js';

/**
 * `@etyma/core`'s `MessageVariables` reads a message's external variables from its literal
 * type, with template-literal types rather than a parser. This table is the contract between
 * the two readings: each row is checked at runtime against `messageformat`'s own parser (via
 * `analyzeMessage`), and at compile time against `MessageVariables` (the `Agrees` assertion
 * below fails `pnpm typecheck` if any row disagrees).
 */
const samples = [
  ['Docs', []],
  ['Hello, {$name}!', ['name']],
  ['{ $spaced }', ['spaced']],
  ['© {$year :number useGrouping=never} {$author}.', ['author', 'year']],
  [
    '.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}',
    ['count'],
  ],
  ['{$n :number minimumFractionDigits=$digits}', ['digits', 'n']],
  ['{$n :number minimumFractionDigits = $digits}', ['digits', 'n']],
  ['.local $total = {$price :number}\n{{Total: {$total}}}', ['price']],
  ['{|literal| :string} {:string} {#b}bold{/b}', []],
  ['Use \\{$name\\} literally', []],
  ['.input {$a :number}\n.local $b = {$a :number}\n{{{$b} of {$c}}}', ['a', 'c']],
] as const;

type Sample = (typeof samples)[number];

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Agrees<S extends Sample> = S extends readonly [infer M extends string, infer V]
  ? V extends readonly string[]
    ? Equal<MessageVariables<M>, V[number]>
    : false
  : false;

// Compile-time half of the parity check. `Agrees` distributes over the rows, so one
// disagreeing row makes it `boolean`, and this type `never`.
const typesAgree: false extends Agrees<Sample> ? never : true = true;

describe('MessageVariables agrees with the MessageFormat 2 parser', () => {
  it.each(samples)('%j', (source, expected) => {
    const variables = analyzeMessage(source).variables;

    expect(variables).toBeDefined();
    expect([...(variables ?? [])].sort()).toEqual([...expected]);
    expect(typesAgree).toBe(true);
  });
});
