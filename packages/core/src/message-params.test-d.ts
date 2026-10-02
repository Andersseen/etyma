import { describe, expectTypeOf, it } from 'vitest';

import arrayCatalog from './__fixtures__/array-catalog.json' with { type: 'json' };
import contractCatalog from './__fixtures__/contract-catalog.json' with { type: 'json' };
import { defineI18n, type I18nDefinition } from './define-i18n.js';
import {
  defineMessageContract,
  defineMessages,
  type DateTimeMessageParam,
  type MessageContract,
  type MessageParamsMap,
  type MessageParamsOf,
  type MessageParamValue,
  type MessageVariables,
  type NumericMessageParam,
} from './messages.js';
import { defineRemoteI18n } from './remote-i18n.js';
import type { Translator } from './translator.js';

/** How a framework layer reaches a typed translator: inferred from the definition alone. */
declare function translatorFor<TKey extends string, TParams extends MessageParamsMap>(
  definition: I18nDefinition<TKey, TParams>,
): Translator<TKey, TParams>;

describe('MessageVariables', () => {
  it('reads placeholders, with or without an annotation', () => {
    expectTypeOf<MessageVariables<'Hello, {$name}!'>>().toEqualTypeOf<'name'>();
    expectTypeOf<
      MessageVariables<'© {$year :number useGrouping=never} {$author}.'>
    >().toEqualTypeOf<'year' | 'author'>();
    expectTypeOf<MessageVariables<'{ $spaced }'>>().toEqualTypeOf<'spaced'>();
  });

  it('reads .input declarations and quoted variants', () => {
    expectTypeOf<
      MessageVariables<'.input {$count :number}\n.match $count\none {{{$count} item}}\n*   {{{$count} items}}'>
    >().toEqualTypeOf<'count'>();
  });

  it('reads variable option values', () => {
    expectTypeOf<MessageVariables<'{$n :number minimumFractionDigits=$digits}'>>().toEqualTypeOf<
      'n' | 'digits'
    >();
    expectTypeOf<MessageVariables<'{$n :number minimumFractionDigits = $digits}'>>().toEqualTypeOf<
      'n' | 'digits'
    >();
  });

  it('leaves out names a .local declaration binds', () => {
    expectTypeOf<
      MessageVariables<'.local $total = {$price :number}\n{{Total: {$total}}}'>
    >().toEqualTypeOf<'price'>();
  });

  it('is never for text, literals, functions, markup, escapes and plain string', () => {
    expectTypeOf<MessageVariables<'Docs'>>().toBeNever();
    expectTypeOf<MessageVariables<'{|literal| :string} {:fn} {#b}bold{/b}'>>().toBeNever();
    expectTypeOf<MessageVariables<'Use \\{$name} literally'>>().toBeNever();
    expectTypeOf<MessageVariables<string>>().toBeNever();
  });
});

describe('MessageParamsOf', () => {
  it('maps every message with variables to its exact params, arrays included', () => {
    interface Source {
      readonly nav: { readonly docs: 'Docs' };
      readonly welcome: 'Hello, {$name}!';
      readonly steps: readonly ['Create an account', 'Choose {$plan}'];
      readonly json: string;
    }

    expectTypeOf<MessageParamsOf<Source>>().toEqualTypeOf<{
      welcome: { readonly name: MessageParamValue };
      'steps.1': { readonly plan: MessageParamValue };
    }>();
  });
});

describe('typed params through a definition', () => {
  const t = translatorFor(
    defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: defineMessages({
        nav: { docs: 'Docs' },
        welcome: 'Hello, {$name}!',
        footer: { rights: '© {$year :number useGrouping=never} {$author}' },
        steps: ['Create an account', 'Choose {$plan}'],
      }),
    }),
  );

  it('requires exactly the params a literal message declares', () => {
    t.translate('welcome', { name: 'Ada' });
    t.translate('footer.rights', { year: 2026, author: 'Andrii' });
    t.translate('steps.1', { plan: 'Pro' });
    t.translateToParts('welcome', { name: 'Ada' });

    // @ts-expect-error - `welcome` needs `name`.
    t.translate('welcome');
    // @ts-expect-error - a misspelt param is both missing and extra.
    t.translate('welcome', { nmae: 'Ada' });
    // @ts-expect-error - `author` is missing.
    t.translate('footer.rights', { year: 2026 });
    // @ts-expect-error - an object is not a param value.
    t.translate('welcome', { name: { first: 'Ada' } });
  });

  it('keeps params optional for a message without variables', () => {
    t.translate('nav.docs');
    t.translate('steps.0');
  });

  it('stays untyped for a JSON source, whose messages are plain string', () => {
    const json = translatorFor(
      defineI18n({ locales: ['en'], sourceLocale: 'en', source: arrayCatalog }),
    );

    json.translate('about.paragraphs.1');
    json.translate('about.paragraphs.1', { author: 'Andrii' });
  });

  it('stays untyped for a remote definition whose contract has only keys', () => {
    const remote = translatorFor(
      defineRemoteI18n({
        locales: ['en'],
        sourceLocale: 'en',
        contract: defineMessageContract({ keys: ['welcome'] }),
        loaders: { en: () => ({ welcome: 'Hello, {$name}!' }) },
      }),
    );

    remote.translate('welcome');
    remote.translate('welcome', { name: 'Ada' });
    // @ts-expect-error - keys are still checked.
    remote.translate('nope');
  });

  it('requires, for a key typed as a union, what every member needs', () => {
    const key = 'welcome' as 'welcome' | 'steps.1';

    // @ts-expect-error - `steps.1` needs `plan`, `welcome` needs `name`: neither alone fits both.
    t.translate(key, { name: 'Ada' });
    t.translate(key, { name: 'Ada', plan: 'Pro' });

    const mixed = 'welcome' as 'welcome' | 'nav.docs';

    // @ts-expect-error - `welcome` might be the key, so its `name` is still required.
    t.translate(mixed);
    t.translate(mixed, { name: 'Ada' });
  });
});

describe('typed params through a remote contract', () => {
  const contract = defineMessageContract({
    keys: ['footer.rights', 'nav.docs', 'steps.0', 'steps.1', 'welcome'],
    variables: { 'footer.rights': ['author', 'year'], 'steps.1': ['plan'], welcome: ['name'] },
  });
  const t = translatorFor(
    defineRemoteI18n({
      locales: ['en'],
      sourceLocale: 'en',
      contract,
      loaders: { en: () => ({ welcome: 'Hello, {$name}!' }) },
    }),
  );

  it('carries the listed variables as params', () => {
    expectTypeOf(contract.messageParams).toEqualTypeOf<
      | {
          'footer.rights': Readonly<Record<'author' | 'year', MessageParamValue>>;
          'steps.1': Readonly<Record<'plan', MessageParamValue>>;
          welcome: Readonly<Record<'name', MessageParamValue>>;
        }
      | undefined
    >();
  });

  it('requires exactly those params, and keeps other keys optional', () => {
    t.translate('welcome', { name: 'Ada' });
    t.translate('footer.rights', { author: 'Andrii', year: 2026 });
    t.translate('nav.docs');
    t.translate('steps.0');

    // @ts-expect-error - `welcome` needs `name`.
    t.translate('welcome');
    // @ts-expect-error - `steps.1` needs `plan`, not `name`.
    t.translate('steps.1', { name: 'Ada' });
    // @ts-expect-error - `footer.rights` needs `author` too.
    t.translate('footer.rights', { year: 2026 });
  });

  it('only lists variables for keys the contract has', () => {
    // @ts-expect-error - `nope` is not one of the keys.
    defineMessageContract({ keys: ['welcome'], variables: { nope: ['name'] } });
  });

  it('names a field it does not know as a compile error, rather than ignoring it', () => {
    // @ts-expect-error - `varaibles` is not a contract field.
    defineMessageContract({ keys: ['welcome'], varaibles: { welcome: ['name'] } });
  });

  it('takes one object, not the positional form older contracts used', () => {
    // @ts-expect-error - the keys are a field of the one argument.
    defineMessageContract(['welcome']);
  });

  it('is untyped for a contract without variables, as before', () => {
    const keysOnly = defineMessageContract({ keys: ['welcome'] });

    expectTypeOf(keysOnly).toEqualTypeOf<MessageContract<'welcome'>>();
  });
});

describe('typed params through a static contract', () => {
  // The contract `etyma contract` generates for `contract-catalog.json`.
  const contract = defineMessageContract({
    keys: ['footer.rights', 'nav.docs', 'onboarding.steps.0', 'onboarding.steps.1', 'welcome'],
    variables: { 'footer.rights': ['year'], 'onboarding.steps.1': ['plan'], welcome: ['name'] },
  });

  it('types a JSON source with no contract by keys only (case A)', () => {
    const definition = defineI18n({ locales: ['en'], sourceLocale: 'en', source: contractCatalog });
    const t = translatorFor(definition);

    expectTypeOf(definition.keys).toEqualTypeOf<
      readonly ('nav.docs' | 'welcome' | 'footer.rights' | `onboarding.steps.${number}`)[]
    >();
    t.translate('welcome');
    t.translate('onboarding.steps.7');
  });

  it('types a JSON source with a contract by keys and params (case B)', () => {
    const t = translatorFor(
      defineI18n({ locales: ['en'], sourceLocale: 'en', source: contractCatalog, contract }),
    );

    t.translate('welcome', { name: 'Ada' });
    t.translate('footer.rights', { year: 2026 });
    t.translate('nav.docs');
    t.translate('onboarding.steps.0');
    t.translate('onboarding.steps.1', { plan: 'Pro' });

    // @ts-expect-error - `welcome` needs `name`.
    t.translate('welcome');
    // @ts-expect-error - a misspelt param.
    t.translate('welcome', { nmae: 'Ada' });
    // @ts-expect-error - `footer.rights` needs `year`.
    t.translate('footer.rights');
    // @ts-expect-error - `onboarding.steps.1` needs `plan`.
    t.translate('onboarding.steps.1');
  });

  it('narrows array keys to the exact indexes the contract lists', () => {
    const definition = defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: contractCatalog,
      contract,
    });
    const t = translatorFor(definition);

    expectTypeOf(definition.keys).toEqualTypeOf<
      readonly (
        'footer.rights' | 'nav.docs' | 'onboarding.steps.0' | 'onboarding.steps.1' | 'welcome'
      )[]
    >();
    // @ts-expect-error - the source has two steps.
    t.translate('onboarding.steps.2');
  });

  it('rejects a contract naming a key the source type does not have', () => {
    defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: contractCatalog,
      // @ts-expect-error - `old.key` is not a key of the source.
      contract: defineMessageContract({ keys: ['nav.docs', 'old.key'] }),
    });
  });

  it('keeps literal inference without a contract (case C) and with one (case D)', () => {
    const source = defineMessages({ welcome: 'Hello, {$name}!', nav: { docs: 'Docs' } });
    const plain = translatorFor(defineI18n({ locales: ['en'], sourceLocale: 'en', source }));
    const withContract = translatorFor(
      defineI18n({
        locales: ['en'],
        sourceLocale: 'en',
        source,
        contract: defineMessageContract({
          keys: ['nav.docs', 'welcome'],
          variables: { welcome: ['name'] },
        }),
      }),
    );
    const keysOnly = translatorFor(
      defineI18n({
        locales: ['en'],
        sourceLocale: 'en',
        source,
        contract: defineMessageContract({ keys: ['nav.docs', 'welcome'] }),
      }),
    );

    for (const t of [plain, withContract, keysOnly]) {
      t.translate('welcome', { name: 'Ada' });
      t.translate('nav.docs');
      // @ts-expect-error - `welcome` needs `name`, from the literal or the contract.
      t.translate('welcome');
    }
  });

  it('requires both when a literal and its contract disagree', () => {
    const t = translatorFor(
      defineI18n({
        locales: ['en'],
        sourceLocale: 'en',
        source: defineMessages({ welcome: 'Hello, {$user}!' }),
        contract: defineMessageContract({ keys: ['welcome'], variables: { welcome: ['name'] } }),
      }),
    );

    // @ts-expect-error - a stale contract surfaces as a compile error, not a silent pass.
    t.translate('welcome', { user: 'Ada' });
  });
});

describe('param value types from built-in function annotations', () => {
  const t = translatorFor(
    defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: defineMessages({
        total: 'Total: {$count :number}',
        updated: 'Updated {$when :datetime}',
        raw: '{$value}',
        label: '{$value :string}',
        avatar: '{$user :avatar}',
        plural: '.input {$count :number}\n.match $count\none {{One item}}\n*   {{{$count} items}}',
        reused: '.input {$count :number}\n{{There are {$count} items}}',
        compatible: '{$n :number} and {$n :integer}',
        conflicting: '{$v :number} or {$v :datetime}',
        withString: '{$v :number} or {$v :string}',
        option: '{$amount :number minimumFractionDigits=$digits}',
        mixed: 'Hello {$name}, you have {$count :number} items',
        local: '.local $sum = {$price :number}\n{{Total: {$sum}}}',
        steps: ['Create account', 'Pay {$amount :number}'],
        dates: '{$d :date} {$t :time}',
        money: '{$a :currency currency=EUR} {$p :percent} {$u :unit unit=meter} {$o :offset add=1}',
      }),
    }),
  );

  it('narrows a :number param to number | bigint | string', () => {
    t.translate('total', { count: 12 });
    t.translate('total', { count: 12n });
    t.translate('total', { count: '12' });
    t.translateToParts('total', { count: 12 });
    // @ts-expect-error - a Date is not a numeric message input, even though messageformat's
    // `valueOf()` coercion would format its epoch milliseconds.
    t.translate('total', { count: new Date() });
    // @ts-expect-error - :number rejects a boolean.
    t.translate('total', { count: true });
  });

  it('narrows the other numeric built-ins the same way', () => {
    t.translate('money', { a: 1, p: 0.5, u: 3n, o: '2' });
    // @ts-expect-error - :currency is numeric.
    t.translate('money', { a: new Date(), p: 0.5, u: 3, o: 2 });
  });

  it('narrows a :datetime param to Date | number | string', () => {
    t.translate('updated', { when: new Date() });
    t.translate('updated', { when: 0 });
    t.translate('updated', { when: '2026-09-29' });
    // @ts-expect-error - :datetime rejects a bigint.
    t.translate('updated', { when: 1n });
    // @ts-expect-error - :datetime rejects a boolean.
    t.translate('updated', { when: false });
    t.translate('dates', { d: new Date(), t: 0 });
  });

  it('keeps bare, :string and custom-function params broad', () => {
    expectTypeOf<MessageParamsOf<{ raw: '{$value}' }>>().toEqualTypeOf<{
      raw: { readonly value: MessageParamValue };
    }>();
    t.translate('raw', { value: true });
    t.translate('label', { value: new Date() });
    t.translate('avatar', { user: false });
  });

  it('types an .input param from its declaration, and a later bare use keeps it', () => {
    t.translate('plural', { count: 1 });
    t.translate('reused', { count: 1 });
    // @ts-expect-error - the declaration is :number.
    t.translate('plural', { count: new Date() });
    // @ts-expect-error - the bare `{$count}` does not widen the declaration.
    t.translate('reused', { count: true });
  });

  it('narrows agreeing annotations, and falls back for disagreeing ones', () => {
    expectTypeOf<MessageParamsOf<{ m: '{$n :number} and {$n :integer}' }>>().toEqualTypeOf<{
      m: { readonly n: NumericMessageParam };
    }>();
    t.translate('conflicting', { v: true });
    t.translate('withString', { v: new Date() });
  });

  it('keeps an option-only variable broad, and a local out', () => {
    expectTypeOf<
      MessageParamsOf<{ m: '{$amount :number minimumFractionDigits=$digits}' }>
    >().toEqualTypeOf<{
      m: { readonly amount: NumericMessageParam; readonly digits: MessageParamValue };
    }>();
    t.translate('option', { amount: 1, digits: true });
    t.translate('local', { price: 1 });
    // @ts-expect-error - `sum` is local; `price` is required.
    t.translate('local', { sum: 1 });
  });

  it('does not let a broad param widen a narrow one', () => {
    t.translate('mixed', { name: true, count: 3 });
    // @ts-expect-error - `count` is :number.
    t.translate('mixed', { name: 'Ada', count: new Date() });
  });

  it('types an indexed message', () => {
    t.translate('steps.1', { amount: 9.99 });
    // @ts-expect-error - `steps.1` is :number.
    t.translate('steps.1', { amount: new Date() });
  });

  it('requires, for a union key, a value every member accepts', () => {
    const key = 'total' as 'total' | 'updated';

    t.translate(key, { count: 1, when: new Date() });
    // @ts-expect-error - `total` might be the key, and its `count` rejects a Date.
    t.translate(key, { count: new Date(), when: new Date() });

    const both = 'total' as 'total' | 'reused';

    t.translate(both, { count: 1 });
    // @ts-expect-error - both are numeric.
    t.translate(both, { count: false });
  });

  it('reads escaped braces as text', () => {
    expectTypeOf<MessageParamsOf<{ m: 'Use \\{$x :number} and {$y :number}' }>>().toEqualTypeOf<{
      m: { readonly y: NumericMessageParam };
    }>();
  });
});

describe('param value types through a contract', () => {
  it('keeps the one- and two-argument forms exactly as before', () => {
    expectTypeOf(defineMessageContract({ keys: ['welcome'] })).toEqualTypeOf<
      MessageContract<'welcome'>
    >();
    expectTypeOf(
      defineMessageContract({ keys: ['welcome'], variables: { welcome: ['name'] } }).messageParams,
    ).toEqualTypeOf<{ welcome: { readonly name: MessageParamValue } } | undefined>();
  });

  it('narrows the params the functions argument annotates, and only those', () => {
    const contract = defineMessageContract({
      keys: ['conflict', 'custom', 'total', 'updated', 'welcome'],
      variables: {
        conflict: ['v'],
        custom: ['user'],
        total: ['count', 'label'],
        updated: ['when'],
        welcome: ['name'],
      },
      functions: {
        conflict: { v: ['datetime', 'number'] },
        custom: { user: ['avatar'] },
        total: { count: ['number'] },
        updated: { when: ['datetime'] },
      },
    });

    expectTypeOf(contract.messageParams).toEqualTypeOf<
      | {
          conflict: { readonly v: MessageParamValue };
          custom: { readonly user: MessageParamValue };
          total: { readonly count: NumericMessageParam; readonly label: MessageParamValue };
          updated: { readonly when: DateTimeMessageParam };
          welcome: { readonly name: MessageParamValue };
        }
      | undefined
    >();

    const t = translatorFor(
      defineRemoteI18n({
        locales: ['en'],
        sourceLocale: 'en',
        contract,
        loaders: { en: () => ({}) },
      }),
    );

    t.translate('total', { count: 1, label: true });
    t.translate('updated', { when: new Date() });
    // @ts-expect-error - `count` is :number.
    t.translate('total', { count: new Date(), label: 'x' });
    // @ts-expect-error - `when` is :datetime.
    t.translate('updated', { when: 1n });
  });

  it('only lists functions for listed variables', () => {
    defineMessageContract({
      keys: ['welcome'],
      variables: { welcome: ['name'] },
      // @ts-expect-error - `nope` is not a variable of `welcome`.
      functions: { welcome: { nope: ['number'] } },
    });
  });

  it('merges a literal source and its contract: broad yields, equal agrees, a conflict is never', () => {
    const source = defineMessages({
      total: '{$count :number}',
      raw: '{$value}',
      when: '{$at :datetime}',
    });
    const t = translatorFor(
      defineI18n({
        locales: ['en'],
        sourceLocale: 'en',
        source,
        contract: defineMessageContract({
          keys: ['raw', 'total', 'when'],
          variables: { raw: ['value'], total: ['count'], when: ['at'] },
          functions: {
            raw: { value: ['number'] },
            total: { count: ['number'] },
            when: { at: ['number'] },
          },
        }),
      }),
    );

    // Broad literal + narrow contract, and equal narrow on both sides: narrow.
    t.translate('raw', { value: 1 });
    t.translate('total', { count: 1 });
    // @ts-expect-error - the contract narrowed `value`.
    t.translate('raw', { value: true });
    // @ts-expect-error - a stale contract (:number) contradicts the literal (:datetime).
    t.translate('when', { at: 0 });
  });
});
