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
import { defineI18n, defineMessages, type Locale, type MessageKey } from '@etyma/core';

const source = defineMessages({
  nav: { docs: 'Docs' },
  footer: { rights: 'MIT licensed. {$year :number useGrouping=never}' },
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

@Component({
  selector: 'compat-root',
  template: `
    <p>{{ t('nav.docs') }}</p>
    <p>{{ t('footer.rights', { year: 2026 }) }}</p>
    <p>{{ i18n.path('/docs') }}</p>
    <p>{{ i18n.locale() }} / {{ i18n.direction() }} / {{ i18n.ready() }}</p>
    <button type="button" (click)="switchTo('es')">es</button>
  `,
})
export class CompatRoot {
  protected readonly i18n: EtymaI18n<Key> = injectI18n(i18n);
  protected readonly t = injectT(i18n);

  constructor() {
    // @ts-expect-error - the source catalog has no `nav.nope`, and the published types
    // have to keep rejecting it. If this ever stops being an error, typed keys are broken.
    this.t('nav.nope');
    void known;
  }

  protected switchTo(locale: Locale): void {
    void this.i18n.setLocale(locale);
  }
}

const config: ApplicationConfig = {
  providers: [provideFileRouter(withLocalizedRoutes()), provideEtyma(i18n), provideEtymaAnalog()],
};

void bootstrapApplication(CompatRoot, config);
