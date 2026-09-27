import { describe, expectTypeOf, it } from 'vitest';

import arrayCatalog from './__fixtures__/array-catalog.json' with { type: 'json' };
import { defineI18n, type I18nDefinition } from './define-i18n.js';
import {
  defineMessageContract,
  defineMessages,
  type MessageParamsMap,
  type MessageParamsOf,
  type MessageParamValue,
  type MessageVariables,
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

  it('stays untyped for a remote definition, whose contract has only keys', () => {
    const remote = translatorFor(
      defineRemoteI18n({
        locales: ['en'],
        sourceLocale: 'en',
        contract: defineMessageContract(['welcome']),
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
