import { describe, expectTypeOf, it } from 'vitest';

import arrayCatalog from './__fixtures__/array-catalog.json' with { type: 'json' };
import contractCatalog from './__fixtures__/contract-catalog.json' with { type: 'json' };
import {
  defineI18n,
  type I18nDefinition,
  type I18nKeysRequiringParams,
  type I18nKeysWithoutRequiredParams,
  type I18nMessageArgs,
  type I18nMessageKey,
} from './define-i18n.js';
import {
  defineMessageContract,
  defineMessages,
  type DateTimeMessageParam,
  type MessageArgs,
  type MessageParams,
  type MessageParamsMap,
  type MessageParamValue,
  type NumericMessageParam,
} from './messages.js';
import { defineRemoteI18n } from './remote-i18n.js';
import type { Translator } from './translator.js';

/** How a framework layer reaches a typed translator: inferred from the definition alone. */
declare function translatorFor<TKey extends string, TParams extends MessageParamsMap>(
  definition: I18nDefinition<TKey, TParams>,
): Translator<TKey, TParams>;

const literal = defineI18n({
  locales: ['en'],
  sourceLocale: 'en',
  source: defineMessages({
    nav: { home: 'Home', docs: 'Docs' },
    welcome: 'Hello {$name}',
    total: '{$count :number}',
    updated: 'Updated {$when :datetime}',
    steps: ['Create account', 'Pay {$amount :number}'],
  }),
});

describe('literal source', () => {
  it('derives every key', () => {
    expectTypeOf<I18nMessageKey<typeof literal>>().toEqualTypeOf<
      'nav.home' | 'nav.docs' | 'welcome' | 'total' | 'updated' | 'steps.0' | 'steps.1'
    >();
    expectTypeOf<I18nMessageKey<typeof literal>>().toEqualTypeOf<(typeof literal.keys)[number]>();
  });

  it('splits keys by whether they are known to require params', () => {
    expectTypeOf<I18nKeysRequiringParams<typeof literal>>().toEqualTypeOf<
      'welcome' | 'total' | 'updated' | 'steps.1'
    >();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof literal>>().toEqualTypeOf<
      'nav.home' | 'nav.docs' | 'steps.0'
    >();
  });

  it('derives the exact argument tuple, with narrowed values', () => {
    expectTypeOf<I18nMessageArgs<typeof literal, 'welcome'>>().toEqualTypeOf<
      [params: { readonly name: MessageParamValue }]
    >();
    expectTypeOf<I18nMessageArgs<typeof literal, 'total'>>().toEqualTypeOf<
      [params: { readonly count: NumericMessageParam }]
    >();
    expectTypeOf<I18nMessageArgs<typeof literal, 'updated'>>().toEqualTypeOf<
      [params: { readonly when: DateTimeMessageParam }]
    >();
    expectTypeOf<I18nMessageArgs<typeof literal, 'nav.home'>>().toEqualTypeOf<
      [params?: MessageParams]
    >();
  });

  it('matches what the translator itself accepts', () => {
    expectTypeOf<I18nMessageArgs<typeof literal, 'total'>>().toEqualTypeOf<
      MessageArgs<NonNullable<(typeof literal)['messageParams']>, 'total'>
    >();
  });

  it('keeps the numeric and date-time narrowing', () => {
    type TotalParams = I18nMessageArgs<typeof literal, 'total'>[0];
    type UpdatedParams = I18nMessageArgs<typeof literal, 'updated'>[0];

    expectTypeOf<{ count: Date }>().not.toExtend<TotalParams>();
    expectTypeOf<{ count: number }>().toExtend<TotalParams>();
    expectTypeOf<{ when: bigint }>().not.toExtend<UpdatedParams>();
    expectTypeOf<{ when: Date }>().toExtend<UpdatedParams>();
  });

  it('keeps array precision', () => {
    expectTypeOf<'steps.0'>().toExtend<I18nKeysWithoutRequiredParams<typeof literal>>();
    expectTypeOf<'steps.1'>().toExtend<I18nKeysRequiringParams<typeof literal>>();
  });

  it('rejects keys outside their domain', () => {
    expectTypeOf<'welcome'>().not.toExtend<I18nKeysWithoutRequiredParams<typeof literal>>();
    expectTypeOf<'nav.home'>().not.toExtend<I18nKeysRequiringParams<typeof literal>>();
    expectTypeOf<'footer.nope'>().not.toExtend<I18nMessageKey<typeof literal>>();
  });

  it('is the domain for metadata that t() can translate without a cast', () => {
    const t = translatorFor(literal);

    interface NavigationItem {
      readonly href: string;
      readonly labelKey: I18nKeysWithoutRequiredParams<typeof literal>;
    }

    const NAVIGATION = [
      { href: '/', labelKey: 'nav.home' },
      { href: '/docs', labelKey: 'nav.docs' },
    ] as const satisfies readonly NavigationItem[];

    expectTypeOf(NAVIGATION[0].labelKey).toEqualTypeOf<'nav.home'>();

    const item: NavigationItem = NAVIGATION[1];
    t.translate(item.labelKey);

    const invalid: NavigationItem = {
      href: '/total',
      // @ts-expect-error - `total` requires `count`.
      labelKey: 'total',
    };
    expectTypeOf(invalid).toHaveProperty('href');

    // The broad requiring union is still rejected by t(): the answer is to narrow the keys.
    const broad = 'welcome' as I18nMessageKey<typeof literal>;
    // @ts-expect-error - `broad` may be `welcome`, which needs `name`.
    t.translate(broad);
  });

  it('describes a union key by what every member needs', () => {
    expectTypeOf<I18nMessageArgs<typeof literal, 'welcome' | 'total'>>().toEqualTypeOf<
      [params: { readonly name: MessageParamValue } & { readonly count: NumericMessageParam }]
    >();
    expectTypeOf<I18nMessageArgs<typeof literal, 'welcome' | 'nav.home'>>().toEqualTypeOf<
      [params: { readonly name: MessageParamValue }]
    >();
  });

  it('types a correlated key and params wrapper without assertions', () => {
    const t = translatorFor(literal);

    function translate<K extends I18nMessageKey<typeof literal>>(
      key: K,
      ...args: I18nMessageArgs<typeof literal, K>
    ): string {
      return t.translate(key, ...args);
    }

    translate('nav.home');
    translate('welcome', { name: 'Ada' });
    // @ts-expect-error - `welcome` needs `name`.
    translate('welcome');
  });
});

describe('static JSON + contract', () => {
  const contract = defineMessageContract({
    keys: ['footer.rights', 'nav.docs', 'onboarding.steps.0', 'onboarding.steps.1', 'welcome'],
    variables: { 'footer.rights': ['year'], 'onboarding.steps.1': ['plan'], welcome: ['name'] },
  });
  const _definition = defineI18n({
    locales: ['en'],
    sourceLocale: 'en',
    source: contractCatalog,
    contract,
  });

  it('categorises from the contract, arrays by exact index', () => {
    expectTypeOf<I18nKeysRequiringParams<typeof _definition>>().toEqualTypeOf<
      'footer.rights' | 'onboarding.steps.1' | 'welcome'
    >();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof _definition>>().toEqualTypeOf<
      'nav.docs' | 'onboarding.steps.0'
    >();
    expectTypeOf<I18nMessageArgs<typeof _definition, 'footer.rights'>>().toEqualTypeOf<
      [params: { readonly year: MessageParamValue }]
    >();
  });

  it('knows no required params for a JSON source with no contract', () => {
    const _plain = defineI18n({ locales: ['en'], sourceLocale: 'en', source: arrayCatalog });

    expectTypeOf<I18nKeysRequiringParams<typeof _plain>>().toBeNever();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof _plain>>().toEqualTypeOf<
      I18nMessageKey<typeof _plain>
    >();
    expectTypeOf<'about.paragraphs.1'>().toExtend<I18nKeysWithoutRequiredParams<typeof _plain>>();
  });
});

describe('remote definition', () => {
  const _remote = defineRemoteI18n({
    locales: ['en'],
    sourceLocale: 'en',
    contract: defineMessageContract({
      keys: ['nav.docs', 'steps.0', 'steps.1', 'welcome'],
      variables: { 'steps.1': ['plan'], welcome: ['name'] },
    }),
    loaders: { en: () => ({ welcome: 'Hello {$name}' }) },
  });

  it('works unchanged, with partial variable metadata', () => {
    expectTypeOf<I18nKeysRequiringParams<typeof _remote>>().toEqualTypeOf<'steps.1' | 'welcome'>();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof _remote>>().toEqualTypeOf<
      'nav.docs' | 'steps.0'
    >();
    expectTypeOf<I18nMessageArgs<typeof _remote, 'welcome'>>().toEqualTypeOf<
      [params: { readonly name: MessageParamValue }]
    >();
  });

  it('treats a keys-only contract as knowing no required params', () => {
    const _keysOnly = defineRemoteI18n({
      locales: ['en'],
      sourceLocale: 'en',
      contract: defineMessageContract({ keys: ['welcome', 'nav.docs'] }),
      loaders: { en: () => ({ welcome: 'Hello {$name}' }) },
    });

    expectTypeOf<I18nKeysRequiringParams<typeof _keysOnly>>().toBeNever();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof _keysOnly>>().toEqualTypeOf<
      'welcome' | 'nav.docs'
    >();
  });
});

describe('broad definition', () => {
  type Broad = I18nDefinition<string, MessageParamsMap>;

  it('knows no key requires params, rather than all of them', () => {
    expectTypeOf<I18nMessageKey<Broad>>().toEqualTypeOf<string>();
    expectTypeOf<I18nKeysRequiringParams<Broad>>().toBeNever();
    expectTypeOf<I18nKeysWithoutRequiredParams<Broad>>().toEqualTypeOf<string>();
    expectTypeOf<I18nMessageArgs<Broad, 'anything'>>().toEqualTypeOf<[params?: MessageParams]>();
  });
});

describe('literal + stale contract conflict', () => {
  const _stale = defineI18n({
    locales: ['en'],
    sourceLocale: 'en',
    source: defineMessages({ welcome: 'Hello {$user}', nav: 'Docs' }),
    contract: defineMessageContract({
      keys: ['nav', 'welcome'],
      variables: { welcome: ['name'] },
    }),
  });

  it('still counts a key whose merged params are uninhabitable as requiring params', () => {
    expectTypeOf<I18nKeysRequiringParams<typeof _stale>>().toEqualTypeOf<'welcome'>();
    expectTypeOf<I18nKeysWithoutRequiredParams<typeof _stale>>().toEqualTypeOf<'nav'>();
  });
});
