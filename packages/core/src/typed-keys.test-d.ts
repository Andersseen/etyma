import { describe, expectTypeOf, it } from 'vitest';

import { defineI18n } from './define-i18n.js';
import { defineMessages, type MessageKey } from './messages.js';

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
});
