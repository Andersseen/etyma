# @etyma/angular

Angular bindings for [Etyma](https://github.com/Andersseen/etyma).

Signal-native, standalone, zoneless-first. No NgModule, no RxJS in the public API, and no
dependency on Zone.js — the package still works inside a Zone-based application, it just
never needs one.

> **Alpha.** See the [repository README](https://github.com/Andersseen/etyma#readme) for
> what that means.

## Install

```sh
pnpm add @etyma/core @etyma/angular
```

Requires Angular 21 or 22.

## Use

```ts
// app.config.ts
import { provideEtyma } from '@etyma/angular';
import { i18n } from './i18n/i18n';

export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideEtyma(i18n)],
};
```

```ts
// nav.ts
import { injectI18n } from '@etyma/angular';
import { i18n } from './i18n/i18n';

@Component({
  template: `
    <a [routerLink]="i18n.path('/docs')">{{ t('nav.docs') }}</a>
    <p>{{ t('footer.rights', { year: 2026 }) }}</p>
  `,
})
export class Nav {
  protected readonly i18n = injectI18n(i18n);
  protected readonly t = this.i18n.t;
}
```

Passing the definition is a type-level argument — the instance comes from the injector
either way — and it is what makes `t('nav.dcos')` a compile error. Calling `injectI18n()`
with no argument works too; the keys are then plain strings.

## API

- `provideEtyma(definition, options?)` — registers Etyma. `options.initialLocale` loads and
  activates a locale during application initialization, for an application that decides its
  locale some way other than from the URL.
- `injectI18n(definition?)` — the `EtymaI18n` service, typed against the definition.
- `injectT(definition?)` — just the translate function.
- `EtymaI18n` — `locale`, `direction` and `ready` signals; `t`, `parts`, `has` and `path`;
  `load`, `activate` and `setLocale`.
- `ETYMA_DEFINITION`, `ETYMA_LOCALE_SWITCH` — the tokens an integration layer uses.

## Server rendering

The service is created per application injector, which on a server means per request. Every
piece of mutable state — the active locale, the catalogs loaded so far — lives on the
instance, so two requests rendering two languages at once share nothing.

The active locale and catalogs loaded while rendering are written to Angular's
`TransferState`, so the browser's first i18n state matches the server-rendered HTML and it
does not fetch the same catalog again. The source catalog is left out: it is already in the
JavaScript bundle.

For AnalogJS applications, [`@etyma/analog`](https://www.npmjs.com/package/@etyma/analog)
adds locale-prefixed routing, request-scoped locale resolution and the localized `<head>`.

## Licence

[MIT](./LICENSE).
