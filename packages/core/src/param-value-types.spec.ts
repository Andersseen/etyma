import { DefaultFunctions, DraftFunctions } from 'messageformat/functions';
import { describe, expect, it } from 'vitest';

import { createMessageFormatter } from './format.js';
import type {
  DateTimeMessageFunction,
  MessageParamValue,
  NumericMessageFunction,
} from './messages.js';

/**
 * `NumericMessageParam` and `DateTimeMessageParam` are Etyma's compile-time reading of what
 * the installed `messageformat` accepts. This is the runtime half: it pins the built-in
 * function set and the value classes each accepts or rejects, so a `messageformat` upgrade
 * that changes either fails here and forces a review of the mapping in `messages.ts`.
 *
 * Only observable behaviour - formatted with or without a `bad-operand` issue - is checked,
 * never how `messageformat` gets there.
 */

// Each function with the options it needs to format at all.
const numeric = {
  number: '{$v :number}',
  integer: '{$v :integer}',
  offset: '{$v :offset add=1}',
  currency: '{$v :currency currency=EUR}',
  percent: '{$v :percent}',
  unit: '{$v :unit unit=meter}',
} as const satisfies Record<NumericMessageFunction, string>;

const dateTime = {
  date: '{$v :date}',
  time: '{$v :time}',
  datetime: '{$v :datetime}',
} as const satisfies Record<DateTimeMessageFunction, string>;

// The compile-time lists must name exactly these: `satisfies` rejects a missing entry, and
// this rejects an extra one.
type Exact<T, K extends PropertyKey> = [keyof T] extends [K] ? true : false;
const exact: [
  Exact<typeof numeric, NumericMessageFunction>,
  Exact<typeof dateTime, DateTimeMessageFunction>,
] = [true, true];

function issues(source: string, value: MessageParamValue): unknown[] {
  const found: unknown[] = [];
  const formatter = createMessageFormatter({ onIssue: issue => found.push(issue.error) });

  formatter.format('en', 'k', source, { v: value });

  return found;
}

describe('messageformat built-in function contracts', () => {
  it('registers exactly the built-ins Etyma types', () => {
    expect(exact).toEqual([true, true]);
    expect(Object.keys(DefaultFunctions).sort()).toEqual(['integer', 'number', 'offset', 'string']);
    expect(Object.keys(DraftFunctions).sort()).toEqual(
      ['currency', 'date', 'datetime', 'percent', 'time', 'unit'].sort(),
    );
  });

  describe.each(Object.entries(numeric))(':%s', (_name, source) => {
    it.each([12, 12n, '12'])('accepts %s', value => {
      expect(issues(source, value)).toEqual([]);
    });

    it('rejects a boolean', () => {
      expect(issues(source, true)).toHaveLength(1);
    });

    it('rejects a non-numeric string at runtime only - a type is not a validator', () => {
      expect(issues(source, 'hello')).toHaveLength(1);
    });
  });

  describe.each(Object.entries(dateTime))(':%s', (_name, source) => {
    it.each([new Date(0), 0, '2026-09-29T12:00:00Z'])('accepts %s', value => {
      expect(issues(source, value)).toEqual([]);
    });

    it.each([1n, true])('rejects %s', value => {
      expect(issues(source, value)).toHaveLength(1);
    });
  });

  it(':string accepts every MessageParamValue, so it narrows nothing', () => {
    for (const value of ['x', 1, 1n, true, new Date(0)]) {
      expect(issues('{$v :string}', value)).toEqual([]);
    }
  });
});
