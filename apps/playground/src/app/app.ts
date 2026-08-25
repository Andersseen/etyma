import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Locale } from '@etyma/core';

import { injectAppI18n } from './i18n/inject';

/** Written in the language they name, which is what a reader looks for in a switcher. */
const LOCALE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  uk: 'Українська',
};

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header>
        <nav aria-label="Main">
          <ul>
            <li>
              <a
                [routerLink]="i18n.path('/')"
                routerLinkActive
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: true }"
                data-testid="nav-home"
                >{{ t('nav.home') }}</a
              >
            </li>
            <li>
              <a
                [routerLink]="i18n.path('/docs')"
                routerLinkActive
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="{ exact: true }"
                data-testid="nav-docs"
                >{{ t('nav.docs') }}</a
              >
            </li>
            <li>
              <a
                [routerLink]="i18n.path('/docs/button')"
                routerLinkActive
                ariaCurrentWhenActive="page"
                data-testid="nav-button"
                >{{ t('nav.button') }}</a
              >
            </li>
            <li>
              <a
                [routerLink]="i18n.path('/docs/themes')"
                routerLinkActive
                ariaCurrentWhenActive="page"
                data-testid="nav-themes"
                >{{ t('nav.themes') }}</a
              >
            </li>
          </ul>
        </nav>

        <div class="locales">
          <span id="locale-label">{{ t('nav.language') }}</span>
          @for (locale of i18n.locales; track locale) {
            <button
              type="button"
              [attr.data-testid]="'switch-' + locale"
              [attr.aria-pressed]="locale === i18n.locale()"
              (click)="switchTo(locale)"
            >
              {{ nameOf(locale) }}
            </button>
          }
        </div>
      </header>

      <main id="main">
        <router-outlet />
      </main>

      <footer>
        <p data-testid="footer">{{ t('footer.rights', { year: year }) }}</p>
      </footer>
    </div>
  `,
})
export class App {
  protected readonly i18n = injectAppI18n();

  /**
   * Held directly rather than called through the service in every binding.
   *
   * The signal reads happen inside `t`, so the template still re-renders on a language
   * change; this only saves a hop.
   */
  protected readonly t = this.i18n.t;

  protected readonly year = new Date().getFullYear();

  protected nameOf(locale: Locale): string {
    return LOCALE_NAMES[locale] ?? locale;
  }

  /**
   * Switching language is a navigation.
   *
   * `@etyma/analog` loads the catalog and then moves the URL, so the address bar and the
   * rendered language never disagree and the new page never flashes the old one.
   */
  protected switchTo(locale: Locale): void {
    void this.i18n.setLocale(locale).catch((error: unknown) => {
      console.error(error);
    });
  }
}
