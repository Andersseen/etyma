import { describe, expect, it, vi } from 'vitest';

import { createCatalogRegistry } from './catalog-registry.js';
import { defineI18n } from './define-i18n.js';
import { createMessageFormatter } from './format.js';
import type { MessageLoader } from './loader.js';
import { defineMessageContract } from './messages.js';
import { defineRemoteI18n } from './remote-i18n.js';
import { createTranslator } from './translator.js';

const source = { nav: { docs: 'Docs' } };

function definitionWith(loaders: Partial<Record<'es' | 'uk', MessageLoader>>) {
  return defineI18n({ locales: ['en', 'es', 'uk'], sourceLocale: 'en', source, loaders });
}

const spanish = { nav: { docs: 'Documentación' } };
const ukrainian = { nav: { docs: 'Документація' } };

describe('createCatalogRegistry', () => {
  it('has the source catalog without loading anything', () => {
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
    );

    expect(registry.has('en')).toBe(true);
    expect(registry.get('en')?.get('nav.docs')).toBe('Docs');
  });

  it('loads a locale on demand', async () => {
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
    );

    expect(registry.has('es')).toBe(false);
    await registry.load('es');
    expect(registry.get('es')?.get('nav.docs')).toBe('Documentación');
  });

  it('runs one load for concurrent requests for the same locale', async () => {
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(definitionWith({ es, uk: () => ukrainian }));

    await Promise.all([registry.load('es'), registry.load('es'), registry.load('es')]);

    expect(es).toHaveBeenCalledOnce();
  });

  it('does not reload a locale it already has', async () => {
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(definitionWith({ es, uk: () => ukrainian }));

    await registry.load('es');
    await registry.load('es');

    expect(es).toHaveBeenCalledOnce();
  });

  it('announces every catalog that arrives', async () => {
    const onChange = vi.fn<(locale: string) => void>();
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
      { onChange },
    );

    await registry.load('es');
    await registry.load('uk');

    expect(onChange.mock.calls.map(([locale]) => locale)).toEqual(['es', 'uk']);
  });

  it('rejects an unconfigured locale rather than resolving to nothing', async () => {
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
    );

    await expect(registry.load('de')).rejects.toThrow(/No message loader is configured/);
  });

  it('retries after a failed load instead of caching the failure', async () => {
    let attempt = 0;
    const es = vi.fn(() => {
      attempt += 1;

      if (attempt === 1) {
        throw new Error('network');
      }

      return spanish;
    });
    const registry = createCatalogRegistry(definitionWith({ es, uk: () => ukrainian }));

    await expect(registry.load('es')).rejects.toThrow('network');
    await expect(registry.load('es')).resolves.toBeDefined();
    expect(registry.has('es')).toBe(true);
  });

  it('leaves the source catalog out of the transfer payload, since it is in the bundle', async () => {
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
    );

    await registry.load('es');

    expect(registry.dehydrate()).toEqual({ es: { 'nav.docs': 'Documentación' } });
  });

  it('adopts a snapshot without running a loader', () => {
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(definitionWith({ es, uk: () => ukrainian }), {
      snapshot: { es: { 'nav.docs': 'Documentación' } },
    });

    expect(registry.has('es')).toBe(true);
    expect(es).not.toHaveBeenCalled();
  });

  it('resolves a load from the snapshot, so hydration does not refetch', async () => {
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(definitionWith({ es, uk: () => ukrainian }), {
      snapshot: { es: { 'nav.docs': 'Documentación' } },
    });

    await registry.load('es');

    expect(es).not.toHaveBeenCalled();
  });

  it('keeps two registries isolated, as two concurrent requests need', async () => {
    const definition = definitionWith({ es: () => spanish, uk: () => ukrainian });
    const first = createCatalogRegistry(definition);
    const second = createCatalogRegistry(definition);

    await first.load('es');

    expect(first.has('es')).toBe(true);
    expect(second.has('es')).toBe(false);
    expect(second.loaded).toEqual(['en']);
  });

  it('never reports contract drift, since the source catalog is the contract', async () => {
    const onContractDrift = vi.fn();
    const registry = createCatalogRegistry(
      definitionWith({ es: () => spanish, uk: () => ukrainian }),
      { onContractDrift },
    );

    await registry.load('es');

    expect(onContractDrift).not.toHaveBeenCalled();
  });
});

const english = { nav: { docs: 'Docs' } };

function remoteDefinitionWith(overrides: Partial<Record<'en' | 'es' | 'uk', MessageLoader>>) {
  return defineRemoteI18n({
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
    contract: defineMessageContract(['nav.docs']),
    loaders: {
      en: () => english,
      es: () => spanish,
      uk: () => ukrainian,
      ...overrides,
    },
  });
}

describe('createCatalogRegistry, remote mode', () => {
  it('starts with nothing loaded, unlike static mode', () => {
    const registry = createCatalogRegistry(remoteDefinitionWith({}));

    expect(registry.loaded).toEqual([]);
    expect(registry.has('en')).toBe(false);
  });

  it('loading a target locale also loads the source locale, concurrently', async () => {
    const en = vi.fn(() => english);
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(remoteDefinitionWith({ en, es }));

    await registry.load('es');

    expect(en).toHaveBeenCalledOnce();
    expect(es).toHaveBeenCalledOnce();
    expect(registry.get('en')?.get('nav.docs')).toBe('Docs');
    expect(registry.get('es')?.get('nav.docs')).toBe('Documentación');
  });

  it('does not reload the source locale once it is in memory', async () => {
    const en = vi.fn(() => english);
    const registry = createCatalogRegistry(remoteDefinitionWith({ en }));

    await registry.load('es');
    await registry.load('uk');

    expect(en).toHaveBeenCalledOnce();
  });

  it('loading the source locale directly does not touch any target locale', async () => {
    const en = vi.fn(() => english);
    const es = vi.fn(() => spanish);
    const registry = createCatalogRegistry(remoteDefinitionWith({ en, es }));

    await registry.load('en');

    expect(en).toHaveBeenCalledOnce();
    expect(es).not.toHaveBeenCalled();
  });

  it('propagates a source-locale failure to a concurrent target load', async () => {
    const registry = createCatalogRegistry(
      remoteDefinitionWith({
        en: () => {
          throw new Error('source down');
        },
      }),
    );

    await expect(registry.load('es')).rejects.toThrow('source down');
  });

  it('includes the source catalog in the transfer payload, unlike static mode', async () => {
    const registry = createCatalogRegistry(remoteDefinitionWith({}));

    await registry.load('en');

    expect(registry.dehydrate()).toEqual({ en: { 'nav.docs': 'Docs' } });
  });

  it('adopts a transferred source-locale snapshot instead of fetching it again', async () => {
    const en = vi.fn(() => english);
    const registry = createCatalogRegistry(remoteDefinitionWith({ en }), {
      snapshot: { en: { 'nav.docs': 'Docs' } },
    });

    expect(registry.has('en')).toBe(true);

    await registry.load('en');

    expect(en).not.toHaveBeenCalled();
  });

  it('reports contract drift exactly once, with the missing and extra keys', async () => {
    const onContractDrift = vi.fn();
    const registry = createCatalogRegistry(
      remoteDefinitionWith({ en: () => ({ nav: { docs: 'Docs' }, extra: { key: 'Surprise' } }) }),
      { onContractDrift },
    );

    await registry.load('en');

    expect(onContractDrift).toHaveBeenCalledOnce();
    expect(onContractDrift).toHaveBeenCalledWith({
      locale: 'en',
      missing: [],
      extra: ['extra.key'],
    });
  });

  it('does not report drift a second time once the source has already been checked', async () => {
    const onContractDrift = vi.fn();
    const registry = createCatalogRegistry(remoteDefinitionWith({}), { onContractDrift });

    await registry.load('en');
    await registry.load('es');

    expect(onContractDrift).not.toHaveBeenCalled();
  });

  it('does not report drift when the loaded catalog matches the contract', async () => {
    const onContractDrift = vi.fn();
    const registry = createCatalogRegistry(remoteDefinitionWith({}), { onContractDrift });

    await registry.load('en');

    expect(onContractDrift).not.toHaveBeenCalled();
  });
});

describe('createCatalogRegistry, arrays of messages', () => {
  const arraySource = {
    features: ['One', 'Two'],
    steps: ['Hello, {$name}!', 'You have {$count :number} items.'],
  };

  function arrayDefinition(es: MessageLoader) {
    return defineI18n({
      locales: ['en', 'es'],
      sourceLocale: 'en',
      source: arraySource,
      loaders: { es },
    });
  }

  it('falls back to the source for an index the translation lacks, like any missing key', async () => {
    const definition = arrayDefinition(() => ({ features: ['Uno'], steps: ['¡Hola, {$name}!'] }));
    const registry = createCatalogRegistry(definition);

    await registry.load('es');

    const t = createTranslator({
      locale: 'es',
      catalog: registry.get('es'),
      sourceLocale: 'en',
      sourceCatalog: definition.sourceCatalog,
      formatter: createMessageFormatter(),
    });

    expect(t.translate('features.0')).toBe('Uno');
    expect(t.translate('features.1')).toBe('Two');
    expect(t.translate('steps.0', { name: 'Ada' })).toBe('¡Hola, Ada!');
    expect(t.translate('steps.1', { count: 3 })).toBe('You have 3 items.');
  });

  it('transfers flattened indexed keys, so the snapshot format does not change', async () => {
    const registry = createCatalogRegistry(arrayDefinition(() => ({ features: ['Uno', 'Dos'] })));

    await registry.load('es');

    const snapshot = registry.dehydrate();

    expect(snapshot).toEqual({ es: { 'features.0': 'Uno', 'features.1': 'Dos' } });

    const es = vi.fn(() => ({ features: ['never loaded'] }));
    const hydrated = createCatalogRegistry(arrayDefinition(es), {
      snapshot: JSON.parse(JSON.stringify(snapshot)) as typeof snapshot,
    });

    await hydrated.load('es');

    expect(es).not.toHaveBeenCalled();
    expect(hydrated.get('es')?.get('features.1')).toBe('Dos');
  });

  it('reports a remote source that grew an array element as ordinary contract drift', async () => {
    const onContractDrift = vi.fn();
    const definition = defineRemoteI18n({
      locales: ['en'],
      sourceLocale: 'en',
      contract: defineMessageContract(['features.0', 'features.1']),
      loaders: { en: () => ({ features: ['A', 'B', 'C'] }) },
    });

    await createCatalogRegistry(definition, { onContractDrift }).load('en');

    expect(onContractDrift).toHaveBeenCalledWith({
      locale: 'en',
      missing: [],
      extra: ['features.2'],
    });
  });
});
