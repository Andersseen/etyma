/**
 * A clean consumer of the packages Etyma would publish.
 *
 * This file is compiled against the packed tarballs, once per supported Angular version,
 * by a project that shares nothing with the workspace. It exists to catch the class of
 * mistake no test inside the repository can see: an `exports` map that resolves in the
 * monorepo but not from `node_modules`, a declaration file that needs a `paths` mapping to
 * work, an Angular partial declaration a newer compiler refuses to link.
 *
 * Nothing here needs to be interesting. It needs to touch the public API and build.
 */
import { provideFileRouter } from '@analogjs/router';
import { Component, type ApplicationConfig } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideEtymaAnalog, withLocalizedRoutes } from '@etyma/analog';
import { EtymaI18n, injectI18n, injectT, provideEtyma } from '@etyma/angular';
import {
  defineI18n,
  defineMessages,
  type I18nKeysRequiringParams,
  type I18nKeysWithoutRequiredParams,
  type Locale,
  type MessageKey,
} from '@etyma/core';

const source = defineMessages({
  nav: { docs: 'Docs' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
  features: ['Typed keys', 'Hello, {$name}!'],
  updated: 'Updated {$when :datetime}',
});

const i18n = defineI18n({
  locales: ['en', 'es'],
  sourceLocale: 'en',
  source,
  loaders: { es: () => import('./es.json') },
});

/** The key contract has to survive being packaged, or typed keys are a repo-only feature. */
type Key = MessageKey<typeof source>;
const known: Key = 'footer.rights';

/** Metadata that stores keys: only keys `t()` accepts with no argument may live here. */
interface NavigationItem {
  readonly labelKey: I18nKeysWithoutRequiredParams<typeof i18n>;
}

const NAVIGATION = [{ labelKey: 'nav.docs' }] as const satisfies readonly NavigationItem[];

// @ts-expect-error - `footer.rights` requires `year`, so it cannot be navigation metadata.
const notNavigation: NavigationItem = { labelKey: 'footer.rights' };
const requiring: I18nKeysRequiringParams<typeof i18n> = 'footer.rights';

@Component({
  selector: 'compat-root',
  template: `
    <p>{{ t('nav.docs') }}</p>
    @for (item of navigation; track item.labelKey) {
      <a>{{ t(item.labelKey) }}</a>
    }
    <p>{{ t('footer.rights', { year: 2026 }) }}</p>
    <p>{{ t('features.0') }} / {{ t('features.1', { name: 'Ada' }) }}</p>
    <p>{{ t('updated', { when: builtAt }) }} / {{ t('footer.rights', { year: '2026' }) }}</p>
    <p>{{ i18n.path('/docs') }}</p>
    <p>{{ i18n.locale() }} / {{ i18n.direction() }} / {{ i18n.ready() }}</p>
    <button type="button" (click)="switchTo('es')">es</button>
  `,
})
export class CompatRoot {
  protected readonly i18n: EtymaI18n<Key> = injectI18n(i18n);
  protected readonly t = injectT(i18n);
  protected readonly builtAt = new Date(0);
  protected readonly navigation: readonly NavigationItem[] = NAVIGATION;

  constructor() {
    // @ts-expect-error - the source catalog has no `nav.nope`, and the published types
    // have to keep rejecting it. If this ever stops being an error, typed keys are broken.
    this.t('nav.nope');
    // @ts-expect-error - `features` is a two-element tuple in the source, so its indexes are
    // exact through the packed declarations too.
    this.t('features.2');
    // @ts-expect-error - `footer.rights` declares `{$year}`, so its params are required -
    // typed params have to survive packaging just as typed keys do.
    this.t('footer.rights');
    // @ts-expect-error - `{$year :number}` narrows the value: a Date is not a numeric input.
    this.t('footer.rights', { year: new Date() });
    // @ts-expect-error - `{$when :datetime}` does not take a boolean.
    this.t('updated', { when: true });
    void known;
    void notNavigation;
    void requiring;
  }

  protected switchTo(locale: Locale): void {
    void this.i18n.setLocale(locale);
  }
}

const config: ApplicationConfig = {
  providers: [provideFileRouter(withLocalizedRoutes()), provideEtyma(i18n), provideEtymaAnalog()],
};

void bootstrapApplication(CompatRoot, config);
