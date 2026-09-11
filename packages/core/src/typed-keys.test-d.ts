import { describe, expectTypeOf, it } from 'vitest';

import { defineI18n } from './define-i18n.js';
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

describe('MessageContract', () => {
  it('carries the exact key union defineMessageContract was given', () => {
    const contract = defineMessageContract(['nav.docs', 'welcome']);

    expectTypeOf(contract.keys).toEqualTypeOf<readonly ('nav.docs' | 'welcome')[]>();
  });

  it('reaches defineRemoteI18n, which has no static source to read a shape from', () => {
    const contract = defineMessageContract(['nav.docs', 'welcome']);
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
    const contract = defineMessageContract(['nav.docs']);

    defineRemoteI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      contract,
      // @ts-expect-error - `es` has no loader; unlike `defineI18n` there is no static source.
      loaders: { en: () => ({ nav: { docs: 'Docs' } }) },
    });
  });
});
