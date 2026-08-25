import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import type { Locale } from '@etyma/core';
import {
  applyVoltTheme,
  VoltButton,
  VoltDropdownMenu,
  VoltDropdownMenuItem,
  VoltDropdownMenuLabel,
  VoltDropdownMenuSeparator,
  VoltDropdownMenuTrigger,
  VoltNavigationMenu,
  VoltNavigationMenuItem,
  VoltNavigationMenuLink,
  VoltNavigationMenuList,
} from '@voltui/components';
import { MOVEMENT_DIRECTIVES } from 'angular-movement';
import { LmnArrowSmallUpIcon } from 'lumen-icons/arrow-small-up';
import { LmnChevronDownIcon } from 'lumen-icons/chevron-down';
import { LmnGithubIcon } from 'lumen-icons/github';
import { LmnGlobeAltIcon } from 'lumen-icons/globe-alt';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnMoonIcon } from 'lumen-icons/moon';
import { LmnSunIcon } from 'lumen-icons/sun';

import { injectAppI18n } from './i18n/inject';

/** Written in the language they name, which is what a reader looks for in a switcher. */
const LOCALE_NAMES: Readonly<Record<string, string>> = {
  en: 'English',
  es: 'Español',
  uk: 'Українська',
};

@Component({
  selector: 'app-root',
  imports: [
    RouterLink,
    RouterOutlet,
    VoltButton,
    VoltDropdownMenu,
    VoltDropdownMenuItem,
    VoltDropdownMenuLabel,
    VoltDropdownMenuSeparator,
    VoltDropdownMenuTrigger,
    VoltNavigationMenu,
    VoltNavigationMenuItem,
    VoltNavigationMenuLink,
    VoltNavigationMenuList,
    ...MOVEMENT_DIRECTIVES,
    LmnArrowSmallUpIcon,
    LmnChevronDownIcon,
    LmnGithubIcon,
    LmnGlobeAltIcon,
    LmnLanguageIcon,
    LmnMoonIcon,
    LmnSunIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-shell min-h-dvh overflow-hidden bg-[var(--page)] text-[var(--ink)]">
      <header class="site-header">
        <div
          class="mx-auto flex h-18 w-full max-w-[1680px] items-center gap-4 px-5 sm:px-6 lg:px-10"
        >
          <a
            class="group flex min-w-0 items-center gap-3 text-sm no-underline"
            [routerLink]="i18n.path('/')"
            data-testid="brand"
          >
            <span
              class="grid size-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.06] text-[var(--accent)] shadow-[inset_0_1px_0_rgb(255_255_255_/_0.08)] transition group-hover:border-[var(--accent)]/45"
            >
              <lmn-language [size]="20" ariaLabel="Etyma" />
            </span>
            <span class="grid min-w-0">
              <strong class="truncate text-[0.98rem] leading-tight text-[var(--nav-ink)]"
                >Etyma</strong
              >
              <small class="truncate text-xs font-semibold text-[var(--nav-muted)]">{{
                t('layout.status')
              }}</small>
            </span>
          </a>

          <volt-navigation-menu class="mx-auto hidden md:block" orientation="horizontal">
            <volt-navigation-menu-list class="nav-list">
              <volt-navigation-menu-item>
                <a
                  voltNavigationMenuLink
                  class="nav-link"
                  [attr.href]="i18n.path('/') + '#features'"
                  data-testid="nav-features"
                  >{{ t('nav.features') }}</a
                >
              </volt-navigation-menu-item>
              <volt-navigation-menu-item>
                <a
                  voltNavigationMenuLink
                  class="nav-link"
                  [attr.href]="i18n.path('/') + '#workflow'"
                  data-testid="nav-workflow"
                  >{{ t('nav.workflow') }}</a
                >
              </volt-navigation-menu-item>
              <volt-navigation-menu-item>
                <a
                  voltNavigationMenuLink
                  class="nav-link"
                  [attr.href]="i18n.path('/') + '#packages'"
                  data-testid="nav-packages"
                  >{{ t('nav.packages') }}</a
                >
              </volt-navigation-menu-item>
            </volt-navigation-menu-list>
          </volt-navigation-menu>

          <div class="ml-auto flex items-center gap-2">
            <a
              class="chrome-icon-link"
              [href]="repoUrl"
              target="_blank"
              rel="noreferrer"
              aria-label="Open Etyma on GitHub"
              data-testid="github-link"
            >
              <lmn-github [size]="20" />
            </a>
            <volt-button
              variant="outline"
              size="sm"
              class="theme-trigger"
              data-testid="theme-toggle"
              [attr.aria-label]="themeAriaLabel()"
              (click)="toggleTheme()"
            >
              @if (theme() === 'dark') {
                <lmn-moon slot="leading" [size]="16" />
              } @else {
                <lmn-sun slot="leading" [size]="16" />
              }
              {{ themeLabel() }}
            </volt-button>
            <volt-button
              variant="outline"
              size="sm"
              class="language-trigger"
              [voltDropdownMenu]="languageMenu"
              placement="bottom-end"
              data-testid="language-trigger"
              [attr.aria-label]="t('nav.language')"
            >
              <lmn-globe-alt slot="leading" [size]="16" />
              {{ nameOf(i18n.locale()) }}
              <lmn-chevron-down slot="trailing" [size]="16" />
            </volt-button>
          </div>
        </div>

        <ng-template #languageMenu>
          <volt-dropdown-menu class="language-menu">
            <volt-dropdown-menu-label>{{ t('nav.language') }}</volt-dropdown-menu-label>
            <volt-dropdown-menu-separator />
            @for (locale of i18n.locales; track locale) {
              <volt-dropdown-menu-item
                [attr.data-testid]="'switch-' + locale"
                [attr.aria-current]="locale === i18n.locale() ? 'true' : null"
                (click)="switchTo(locale)"
              >
                {{ nameOf(locale) }}
              </volt-dropdown-menu-item>
            }
          </volt-dropdown-menu>
        </ng-template>
      </header>

      <main id="main" class="mx-auto w-full max-w-[1680px] px-5 sm:px-6 lg:px-10">
        <router-outlet />
      </main>

      <ng-container *movePresence="showBackToTop()">
        <button
          type="button"
          class="back-to-top"
          data-testid="back-to-top"
          aria-label="Back to top"
          [moveInitial]="{ opacity: 0, y: 18, scale: 0.92 }"
          [moveAnimate]="{ opacity: 1, y: 0, scale: 1 }"
          [moveExit]="{ opacity: 0, y: 18, scale: 0.92 }"
          moveDuration="260"
          (click)="scrollToTop()"
        >
          <lmn-arrow-small-up [size]="24" />
        </button>
      </ng-container>

      <footer
        class="mx-auto flex w-full max-w-[1680px] flex-col gap-2 px-5 py-8 text-sm text-white/48 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10"
      >
        <div class="grid gap-1">
          <strong>Etyma</strong>
          <p class="m-0" data-testid="footer">{{ t('footer.rights', { year: year }) }}</p>
        </div>
        <p class="m-0">{{ t('footer.stack') }}</p>
      </footer>
    </div>
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);

  protected readonly i18n = injectAppI18n();
  protected readonly repoUrl = 'https://github.com/Andersseen/etyma';
  protected readonly theme = signal<'dark' | 'light'>('dark');
  protected readonly themeLabel = computed(() => (this.theme() === 'dark' ? 'Dark' : 'Light'));
  protected readonly themeAriaLabel = computed(() => `Switch to ${this.oppositeTheme()} theme`);
  protected readonly showBackToTop = signal(false);

  private lastScrollY = 0;

  /**
   * Held directly rather than called through the service in every binding.
   *
   * The signal reads happen inside `t`, so the template still re-renders on a language
   * change; this only saves a hop.
   */
  protected readonly t = this.i18n.t;

  protected readonly year = new Date().getFullYear();

  constructor() {
    this.applyTheme(this.theme(), false);

    afterNextRender(() => {
      const view = this.document.defaultView;

      if (view === null) {
        return;
      }

      const storage = this.safeStorage(view);
      const stored = storage?.getItem('etyma-theme');
      const systemTheme =
        typeof view.matchMedia === 'function' &&
        view.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light'
          : 'dark';
      const theme = stored === 'light' || stored === 'dark' ? stored : systemTheme;

      this.applyTheme(theme, false);
      this.lastScrollY = view.scrollY;
    });
  }

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

  protected toggleTheme(): void {
    this.applyTheme(this.oppositeTheme());
  }

  protected scrollToTop(): void {
    this.showBackToTop.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    const y = window.scrollY;
    const goingDown = y > this.lastScrollY + 8;
    const goingUp = y < this.lastScrollY - 8;

    if (goingDown && y > 420) {
      this.showBackToTop.set(true);
    } else if (goingUp || y < 220) {
      this.showBackToTop.set(false);
    }

    this.lastScrollY = y;
  }

  private oppositeTheme(): 'dark' | 'light' {
    return this.theme() === 'dark' ? 'light' : 'dark';
  }

  private applyTheme(theme: 'dark' | 'light', persist = true): void {
    this.theme.set(theme);
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document.documentElement.style.colorScheme = theme;

    if (this.document.defaultView !== null) {
      applyVoltTheme({ color: 'glacier', style: 'sharp', dark: theme === 'dark' }, this.document);
    }

    const view = this.document.defaultView;
    const storage = view === null ? undefined : this.safeStorage(view);

    if (persist) {
      storage?.setItem('etyma-theme', theme);
    }
  }

  private safeStorage(view: Window): Storage | undefined {
    try {
      return view.localStorage;
    } catch {
      return undefined;
    }
  }
}
