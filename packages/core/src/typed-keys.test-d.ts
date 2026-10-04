import { describe, expectTypeOf, it } from 'vitest';

import arrayCatalog from './__fixtures__/array-catalog.json' with { type: 'json' };
import { defineI18n } from './define-i18n.js';
import type { MessageLoader } from './loader.js';
import {
  defineMessageContract,
  defineMessages,
  type MessageContract,
  type MessageKey,
} from './messages.js';
import { defineRemoteI18n } from './remote-i18n.js';

const source = defineMessages({
  nav: { docs: 'Docs', components: 'Components' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
  welcome: 'Hello, {$name}!',
});

describe('typed message keys', () => {
  it('is the set of dotted leaf keys', () => {
    expectTypeOf<MessageKey<typeof source>>().toEqualTypeOf<
      'nav.docs' | 'nav.components' | 'footer.rights' | 'welcome'
    >();
  });

  it('excludes intermediate nodes, which are not messages', () => {
    expectTypeOf<'nav'>().not.toExtend<MessageKey<typeof source>>();
    expectTypeOf<'footer'>().not.toExtend<MessageKey<typeof source>>();
  });

  it('rejects a key the catalog does not define', () => {
    expectTypeOf<'footer.foo'>().not.toExtend<MessageKey<typeof source>>();
    expectTypeOf<'nav.dcos'>().not.toExtend<MessageKey<typeof source>>();
  });

  it('reaches the definition, which is how a framework layer stays typed', () => {
    const definition = defineI18n({ locales: ['en'], sourceLocale: 'en', source });

    expectTypeOf(definition.keys).toEqualTypeOf<
      readonly ('nav.docs' | 'nav.components' | 'footer.rights' | 'welcome')[]
    >();
  });

  it('carries keys through a catalog assembled from JSON and defineMessages together', () => {
    const json = { nav: { docs: 'Docs' } };
    const authored = defineMessages({ seo: { siteName: 'Etyma' } });
    const definition = defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: { ...json, ...authored },
    });

    expectTypeOf(definition.keys).toEqualTypeOf<readonly ('nav.docs' | 'seo.siteName')[]>();
  });

  it('narrows sourceCatalog to non-optional for a static definition', () => {
    const definition = defineI18n({ locales: ['en'], sourceLocale: 'en', source });

    expectTypeOf(definition.sourceCatalog).not.toBeNullable();
  });
});

describe('typed message keys: arrays of messages', () => {
  const _messages = defineMessages({
    features: ['Typed keys', 'MessageFormat 2', 'SSR ready'],
    faq: { answers: ['First', 'Second'] },
    title: 'Etyma',
  });
  type Messages = typeof _messages;

  it('keeps the exact indexes of an array written in defineMessages, which infers a tuple', () => {
    expectTypeOf<MessageKey<Messages>>().toEqualTypeOf<
      'features.0' | 'features.1' | 'features.2' | 'faq.answers.0' | 'faq.answers.1' | 'title'
    >();
  });

  it('rejects an index past the end of a tuple, and the array itself', () => {
    expectTypeOf<'features.3'>().not.toExtend<MessageKey<Messages>>();
    expectTypeOf<'features'>().not.toExtend<MessageKey<Messages>>();
    expectTypeOf<'faq.answers'>().not.toExtend<MessageKey<Messages>>();
  });

  it('carries exact array keys through defineI18n', () => {
    const definition = defineI18n({
      locales: ['en'],
      sourceLocale: 'en',
      source: { steps: ['One', 'Two'] },
    });

    expectTypeOf(definition.keys).toEqualTypeOf<readonly ('steps.0' | 'steps.1')[]>();
  });

  it('widens an imported JSON array to `${number}` indexes, because its type is string[]', () => {
    // What `resolveJsonModule` actually infers: no tuple, no length - so no exact indexes
    // either. Anything else would be claiming knowledge the compiler does not have.
    expectTypeOf(arrayCatalog.home.editorialPoints).toEqualTypeOf<string[]>();
    expectTypeOf<MessageKey<typeof arrayCatalog>>().toEqualTypeOf<
      'home.title' | `home.editorialPoints.${number}` | `about.paragraphs.${number}`
    >();

    // The honest consequence: an index the runtime catalog does not have still type-checks.
    expectTypeOf<'home.editorialPoints.999'>().toExtend<MessageKey<typeof arrayCatalog>>();
    expectTypeOf<'home.editorialPoints.first'>().not.toExtend<MessageKey<typeof arrayCatalog>>();
    expectTypeOf<'home.editorialPoints'>().not.toExtend<MessageKey<typeof arrayCatalog>>();
  });

  it('accepts a JSON catalog with arrays as a static source and from a loader', () => {
    const definition = defineI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      source: arrayCatalog,
      loaders: {
        es: () => import('./__fixtures__/array-catalog.json', { with: { type: 'json' } }),
      },
    });
    const loader: MessageLoader = () => ({ steps: ['One', 'Two'] as string[] });

    expectTypeOf(definition.keys).toEqualTypeOf<readonly MessageKey<typeof arrayCatalog>[]>();
    void loader;
  });

  it('rejects array shapes the catalog grammar does not have', () => {
    // @ts-expect-error - an array of objects is a collection, not a list of messages.
    defineMessages({ team: [{ name: 'Andrii' }] });
    // @ts-expect-error - nested arrays are not a catalog shape.
    defineMessages({ matrix: [['a', 'b']] });
    // @ts-expect-error - array elements are messages, and messages are strings.
    defineMessages({ features: ['Typed', 42] });
  });
});

describe('MessageContract', () => {
  it('carries the exact key union defineMessageContract was given', () => {
    const contract = defineMessageContract({ keys: ['nav.docs', 'welcome'] });

    expectTypeOf(contract.keys).toEqualTypeOf<readonly ('nav.docs' | 'welcome')[]>();
  });

  it('reaches defineRemoteI18n, which has no static source to read a shape from', () => {
    const contract = defineMessageContract({ keys: ['nav.docs', 'welcome'] });
    const definition = defineRemoteI18n({
      locales: ['en'],
      sourceLocale: 'en',
      contract,
      loaders: { en: () => ({ nav: { docs: 'Docs' }, welcome: 'Hello' }) },
    });

    expectTypeOf(definition.keys).toEqualTypeOf<readonly ('nav.docs' | 'welcome')[]>();
  });

  it('rejects a key the contract does not define', () => {
    expectTypeOf<'nav.missing'>().not.toExtend<MessageContract<'nav.docs'>['keys'][number]>();
  });

  it('requires a loader for every locale, including the source, unlike defineI18n', () => {
    const contract = defineMessageContract({ keys: ['nav.docs'] });

    defineRemoteI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      contract,
      // @ts-expect-error - `es` has no loader; unlike `defineI18n` there is no static source.
      loaders: { en: () => ({ nav: { docs: 'Docs' } }) },
    });
  });
});
