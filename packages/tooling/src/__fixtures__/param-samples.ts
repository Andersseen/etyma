/**
 * Source messages and, for each external variable, the functions the caller's value reaches
 * (`[]` for none) - shared by `message-param-types-parity.spec.ts`, which checks them against
 * the parser and `@etyma/core`'s literal types, and `contract-params.spec.ts`, which compiles
 * a contract generated from them.
 */
export const paramSamples = [
  ['Docs', {}],
  ['Hello, {$name}!', { name: [] }],
  ['Total: {$count :number}', { count: ['number'] }],
  ['{ $spaced :datetime }', { spaced: ['datetime'] }],
  ['{$value :string}', { value: ['string'] }],
  ['{$user :avatar}', { user: ['avatar'] }],
  ['{$x :ns:number}', { x: ['ns:number'] }],
  ['© {$year :number useGrouping=never} {$author}.', { author: [], year: ['number'] }],
  [
    '.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}',
    { count: ['number'] },
  ],
  ['.input {$count :number}\n{{There are {$count} items}}', { count: ['number'] }],
  // The declaration rebinds `$d`: the later :datetime formats its resolved number.
  ['.input {$d :number}\n{{{$d :datetime}}}', { d: ['number'] }],
  // A bare declaration does not, so the later annotation reaches the caller's value.
  ['.input {$x}\n{{{$x :number}}}', { x: ['number'] }],
  ['{$n :number} and {$n :integer}', { n: ['integer', 'number'] }],
  ['{$when :date length=long} at {$when :time}', { when: ['date', 'time'] }],
  ['{$v :number} or {$v :datetime}', { v: ['datetime', 'number'] }],
  ['{$v :number} or {$v :string}', { v: ['number', 'string'] }],
  ['{$v :number} or {$v}', { v: ['number'] }],
  ['{$n :number minimumFractionDigits=$digits}', { digits: [], n: ['number'] }],
  ['.local $total = {$price :number}\n{{Total: {$total}}}', { price: ['number'] }],
  ['.local $t = {$p :number}\n{{{$t :integer}}}', { p: ['number'] }],
  ['.input {$a :number}\n.local $b = {$a :number}\n{{{$b} of {$c}}}', { a: ['number'], c: [] }],
  [
    '.input {$n :number}\n.match $n\none {{{$n} at {$w :datetime}}}\n*   {{{$w :datetime}}}',
    { n: ['number'], w: ['datetime'] },
  ],
  // `.input` as text in a simple message is not a declaration.
  ['Type .input {$x :number} or {$x :datetime}', { x: ['datetime', 'number'] }],
  ['Use \\{$name\\} literally, {$n :percent}', { n: ['percent'] }],
  ['{|literal| :string} {:string} {#b}bold{/b}', {}],
] as const;
