import {
  ApplicationInitStatus,
  ChangeDetectionStrategy,
  Component,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  defineI18n,
  defineMessageContract,
  defineRemoteI18n,
  type CatalogSnapshot,
  type MessageLoader,
} from '@etyma/core';
import { describe, expect, it, vi } from 'vitest';

import { EtymaI18n } from './i18n.js';
import { injectI18n, injectT } from './inject.js';
import { provideEtyma } from './provide.js';

interface EtymaHydrationState {
  readonly locale: string;
  readonly catalogs: CatalogSnapshot;
}

const source = {
  nav: { docs: 'Docs' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
  onlyEnglish: 'Only in the source catalog',
};

const spanish = {
  nav: { docs: 'Documentación' },
  footer: { rights: 'Licencia MIT. {$year :number useGrouping=never}' },
};
const ukrainian = {
  nav: { docs: 'Документація' },
  footer: { rights: 'Ліцензія MIT. {$year :number useGrouping=never}' },
};

function definition(loaders?: { es?: MessageLoader; uk?: MessageLoader }) {
  return defineI18n({
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
    source,
    loaders: {
      es: loaders?.es ?? (() => spanish),
      uk: loaders?.uk ?? (() => ukrainian),
    },
  });
}

const remoteContract = defineMessageContract(['nav.docs', 'footer.rights', 'onlyEnglish']);

function remoteDefinition(loaders?: {
  en?: MessageLoader;
  es?: MessageLoader;
  uk?: MessageLoader;
}) {
  return defineRemoteI18n({
    locales: ['en', 'es', 'uk'],
    sourceLocale: 'en',
    contract: remoteContract,
    loaders: {
      en: loaders?.en ?? (() => source),
      es: loaders?.es ?? (() => spanish),
      uk: loaders?.uk ?? (() => ukrainian),
    },
  });
}

describe('provideEtyma', () => {
  it('makes the service injectable', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    expect(TestBed.inject(EtymaI18n)).toBeInstanceOf(EtymaI18n);
  });

  it('starts in the source locale, with the source catalog already in memory', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.locale()).toBe('en');
    expect(i18n.ready()).toBe(true);
    expect(i18n.t('nav.docs')).toBe('Docs');
  });

  it('activates an initial locale as an application initializer', async () => {
    TestBed.configureTestingModule({
      providers: [provideEtyma(definition(), { initialLocale: 'uk' })],
    });

    await TestBed.inject(ApplicationInitStatus).donePromise;
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.locale()).toBe('uk');
    expect(i18n.t('nav.docs')).toBe('Документація');
  });
});

describe('EtymaI18n', () => {
  it('does not need Zone.js', () => {
    expect((globalThis as { Zone?: unknown }).Zone).toBeUndefined();

    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    expect(TestBed.inject(EtymaI18n).t('nav.docs')).toBe('Docs');
  });

  it('translates in the locale that is active', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    await i18n.setLocale('es');

    expect(i18n.locale()).toBe('es');
    expect(i18n.t('nav.docs')).toBe('Documentación');
  });

  it('substitutes parameters', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    await i18n.setLocale('uk');

    expect(i18n.t('footer.rights', { year: 2026 })).toBe('Ліцензія MIT. 2026');
  });

  it('falls back to the source locale for an untranslated key', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    await i18n.setLocale('es');

    expect(i18n.t('onlyEnglish')).toBe('Only in the source catalog');
  });

  it('renders the source locale while a catalog is still loading, then the translation', async () => {
    let release!: (catalog: typeof spanish) => void;
    const pending = new Promise<typeof spanish>(resolve => {
      release = resolve;
    });

    TestBed.configureTestingModule({
      providers: [provideEtyma(definition({ es: () => pending }))],
    });
    const i18n = TestBed.inject(EtymaI18n);

    const switching = i18n.setLocale('es');
    expect(i18n.t('nav.docs')).toBe('Docs');

    release(spanish);
    await switching;

    expect(i18n.t('nav.docs')).toBe('Documentación');
  });

  it('reports which locales are loaded, and loads one without switching to it', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.isLoaded('uk')).toBe(false);

    await i18n.load('uk');

    expect(i18n.isLoaded('uk')).toBe(true);
    expect(i18n.locale()).toBe('en');
  });

  it('loads a locale once however many components ask for it', async () => {
    const es = vi.fn(() => spanish);
    TestBed.configureTestingModule({ providers: [provideEtyma(definition({ es }))] });
    const i18n = TestBed.inject(EtymaI18n);

    await Promise.all([i18n.load('es'), i18n.load('es'), i18n.setLocale('es')]);

    expect(es).toHaveBeenCalledOnce();
  });

  it('keeps the most recent locale when overlapping switches finish out of order', async () => {
    let releaseSpanish!: (catalog: typeof spanish) => void;
    let releaseUkrainian!: (catalog: typeof ukrainian) => void;

    const es = new Promise<typeof spanish>(resolve => {
      releaseSpanish = resolve;
    });
    const uk = new Promise<typeof ukrainian>(resolve => {
      releaseUkrainian = resolve;
    });

    TestBed.configureTestingModule({
      providers: [provideEtyma(definition({ es: () => es, uk: () => uk }))],
    });
    const i18n = TestBed.inject(EtymaI18n);

    const spanishSwitch = i18n.setLocale('es');
    const ukrainianSwitch = i18n.setLocale('uk');

    releaseUkrainian(ukrainian);
    await ukrainianSwitch;

    expect(i18n.locale()).toBe('uk');
    expect(i18n.t('nav.docs')).toBe('Документація');

    releaseSpanish(spanish);
    await spanishSwitch;

    expect(i18n.locale()).toBe('uk');
    expect(i18n.t('nav.docs')).toBe('Документація');
  });

  it('refuses a locale it was never configured with', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    await expect(TestBed.inject(EtymaI18n).setLocale('de')).rejects.toThrow(/Unknown locale "de"/);
  });

  it('localizes a path in the active locale', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.path('/docs/button')).toBe('/docs/button');

    await i18n.setLocale('es');

    expect(i18n.path('/docs/button')).toBe('/es/docs/button');
    expect(i18n.path('/docs/button', 'uk')).toBe('/uk/docs/button');
  });

  it('reports the text direction of the active locale', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    expect(TestBed.inject(EtymaI18n).direction()).toBe('ltr');
  });

  it('returns a message as parts rather than as markup', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    const parts = TestBed.inject(EtymaI18n).parts('footer.rights', { year: 2026 });

    expect(parts[0]).toEqual({ type: 'text', value: 'MIT licensed. ' });
    expect(parts[1]).toMatchObject({ type: 'number', locale: 'en' });
  });
});

describe('signal reactivity', () => {
  @Component({
    selector: 'etyma-host',
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `<span>{{ t('nav.docs') }}</span>`,
  })
  class Host {
    protected readonly t = injectT();
  }

  it('re-renders a template when the locale changes', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toBe('Docs');

    await TestBed.inject(EtymaI18n).setLocale('uk');
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toBe('Документація');
  });

  it('re-renders when a catalog finishes loading, without the locale changing again', async () => {
    let release!: (catalog: typeof spanish) => void;
    const pending = new Promise<typeof spanish>(resolve => {
      release = resolve;
    });

    TestBed.configureTestingModule({
      providers: [provideEtyma(definition({ es: () => pending }))],
    });
    const i18n = TestBed.inject(EtymaI18n);
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();

    const switching = i18n.setLocale('es');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toBe('Docs');

    release(spanish);
    await switching;
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toBe('Documentación');
  });
});

describe('injectI18n', () => {
  it('returns the provided instance', () => {
    const shared = definition();
    TestBed.configureTestingModule({ providers: [provideEtyma(shared)] });

    const injected = TestBed.runInInjectionContext(() => injectI18n(shared));

    expect(injected).toBe(TestBed.inject(EtymaI18n));
  });

  it('works with no definition at all, for a component that does not need typed keys', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    expect(TestBed.runInInjectionContext(() => injectT()('nav.docs'))).toBe('Docs');
  });

  it('rejects a definition other than the one that was provided', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(definition())] });

    expect(() => TestBed.runInInjectionContext(() => injectI18n(definition()))).toThrow(
      /different i18n definition/,
    );
  });
});

describe('server rendering', () => {
  it('puts the active locale and loaded catalogs into transfer state, and leaves the source catalog out', async () => {
    TestBed.configureTestingModule({
      providers: [provideEtyma(definition()), { provide: PLATFORM_ID, useValue: 'server' }],
    });

    await TestBed.inject(EtymaI18n).setLocale('es');

    const transferred = TestBed.inject(TransferState).toJson();

    expect(transferred).toContain('"locale":"es"');
    expect(transferred).toContain('Documentación');
    expect(transferred).not.toContain('Only in the source catalog');
  });

  it('hydrates the active locale and catalog before the first client render', () => {
    const es = vi.fn(() => spanish);
    const transferState = new TransferState();
    transferState.set(makeStateKey<EtymaHydrationState>('etyma.hydration'), {
      locale: 'es',
      catalogs: { es: { 'nav.docs': 'Documentación' } },
    });

    TestBed.configureTestingModule({
      providers: [
        provideEtyma(definition({ es })),
        { provide: TransferState, useValue: transferState },
      ],
    });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.locale()).toBe('es');
    expect(i18n.t('nav.docs')).toBe('Documentación');
    expect(es).not.toHaveBeenCalled();
  });

  it('removes transferred hydration state after the browser adopts it', () => {
    const transferState = new TransferState();
    const stateKey = makeStateKey<EtymaHydrationState>('etyma.hydration');
    transferState.set(stateKey, {
      locale: 'uk',
      catalogs: { uk: { 'nav.docs': 'Документація' } },
    });

    TestBed.configureTestingModule({
      providers: [provideEtyma(definition()), { provide: TransferState, useValue: transferState }],
    });
    TestBed.inject(EtymaI18n);

    expect(transferState.hasKey(stateKey)).toBe(false);
  });
});

describe('EtymaI18n, remote source catalog', () => {
  it('starts in the source locale, but not ready until the remote source loads', () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(remoteDefinition())] });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.locale()).toBe('en');
    expect(i18n.ready()).toBe(false);
  });

  it('becomes ready, and translates for real, once the remote source loads', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(remoteDefinition())] });
    const i18n = TestBed.inject(EtymaI18n);

    await i18n.setLocale('en');

    expect(i18n.ready()).toBe(true);
    expect(i18n.t('nav.docs')).toBe('Docs');
  });

  it('loads the remote source alongside a target locale, so fallback works immediately', async () => {
    TestBed.configureTestingModule({ providers: [provideEtyma(remoteDefinition())] });
    const i18n = TestBed.inject(EtymaI18n);

    await i18n.setLocale('es');

    expect(i18n.isLoaded('en')).toBe(true);
    expect(i18n.isLoaded('es')).toBe(true);
    expect(i18n.t('nav.docs')).toBe('Documentación');
    expect(i18n.t('onlyEnglish')).toBe('Only in the source catalog');
  });

  it('warns once, in development, when the loaded remote source drifts from its contract', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      TestBed.configureTestingModule({
        providers: [
          provideEtyma(
            defineRemoteI18n({
              locales: ['en'],
              sourceLocale: 'en',
              contract: defineMessageContract(['nav.docs', 'nav.missing']),
              loaders: { en: () => ({ nav: { docs: 'Docs' }, extra: 'Surprise' }) },
            }),
          ),
        ],
      });

      await TestBed.inject(EtymaI18n).setLocale('en');

      const driftWarnings = warn.mock.calls.filter(
        ([message]) =>
          typeof message === 'string' && message.includes('does not match its contract'),
      );

      expect(driftWarnings).toHaveLength(1);
      expect(driftWarnings[0]?.[1]).toEqual({
        locale: 'en',
        missing: ['nav.missing'],
        extra: ['extra'],
      });
    } finally {
      warn.mockRestore();
    }
  });

  it('never warns when the loaded remote source matches its contract', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      TestBed.configureTestingModule({ providers: [provideEtyma(remoteDefinition())] });

      await TestBed.inject(EtymaI18n).setLocale('en');

      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('server rendering, remote source catalog', () => {
  it('includes the remote source catalog in the transfer payload, unlike static mode', async () => {
    TestBed.configureTestingModule({
      providers: [provideEtyma(remoteDefinition()), { provide: PLATFORM_ID, useValue: 'server' }],
    });

    await TestBed.inject(EtymaI18n).setLocale('es');

    const transferred = TestBed.inject(TransferState).toJson();

    expect(transferred).toContain('"locale":"es"');
    expect(transferred).toContain('Documentación');
    expect(transferred).toContain('Docs');
  });

  it('hydrates a transferred remote source catalog without refetching it', () => {
    const en = vi.fn(() => source);
    const transferState = new TransferState();
    transferState.set(makeStateKey<EtymaHydrationState>('etyma.hydration'), {
      locale: 'es',
      catalogs: {
        en: {
          'nav.docs': 'Docs',
          'footer.rights': 'MIT licensed. {$year :number useGrouping=never}',
          onlyEnglish: 'Only in the source catalog',
        },
        es: { 'nav.docs': 'Documentación' },
      },
    });

    TestBed.configureTestingModule({
      providers: [
        provideEtyma(remoteDefinition({ en })),
        { provide: TransferState, useValue: transferState },
      ],
    });
    const i18n = TestBed.inject(EtymaI18n);

    expect(i18n.locale()).toBe('es');
    expect(i18n.ready()).toBe(true);
    expect(i18n.t('nav.docs')).toBe('Documentación');
    expect(en).not.toHaveBeenCalled();
  });
});
