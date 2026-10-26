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
import { Router, RouterLink, RouterOutlet } from '@angular/router';
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
import { LmnBars3Icon } from 'lumen-icons/bars-3';
import { LmnChevronDownIcon } from 'lumen-icons/chevron-down';
import { LmnGithubIcon } from 'lumen-icons/github';
import { LmnGlobeAltIcon } from 'lumen-icons/globe-alt';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnMoonIcon } from 'lumen-icons/moon';
import { LmnSunIcon } from 'lumen-icons/sun';

import { siteCopy } from './content/site-copy';
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
    LmnBars3Icon,
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
      <a class="skip-link" href="#main">{{ t('nav.skipToContent') }}</a>
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
                  [attr.href]="i18n.path('/') + '#start'"
                  data-testid="nav-start"
                  >{{ copy().nav.start }}</a
                >
              </volt-navigation-menu-item>
              <volt-navigation-menu-item>
                <a
                  voltNavigationMenuLink
                  class="nav-link"
                  [attr.href]="i18n.path('/') + '#tooling'"
                  data-testid="nav-tooling"
                  >{{ t('nav.tooling') }}</a
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
              <volt-navigation-menu-item>
                <a
                  voltNavigationMenuLink
                  class="nav-link"
                  [routerLink]="i18n.path('/docs')"
                  data-testid="nav-docs"
                  >{{ t('nav.docs') }}</a
                >
              </volt-navigation-menu-item>
            </volt-navigation-menu-list>
          </volt-navigation-menu>

          <div class="ml-auto flex items-center gap-2">
            <volt-button
              variant="outline"
              size="sm"
              class="menu-trigger md:hidden"
              [voltDropdownMenu]="mobileMenu"
              placement="bottom-end"
              data-testid="menu-trigger"
              [attr.aria-label]="copy().nav.menu"
            >
              <lmn-bars-3 [size]="20" />
            </volt-button>
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
                <lmn-moon [size]="18" />
              } @else {
                <lmn-sun [size]="18" />
              }
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
              <span class="hidden sm:inline">{{ nameOf(i18n.locale()) }}</span>
              <span class="uppercase sm:hidden">{{ i18n.locale() }}</span>
              <lmn-chevron-down slot="trailing" [size]="16" />
            </volt-button>
          </div>
        </div>

        <ng-template #mobileMenu>
          <volt-dropdown-menu class="language-menu">
            @for (link of mobileLinks(); track link.href) {
              <volt-dropdown-menu-item (click)="go(link.href)">{{
                link.label
              }}</volt-dropdown-menu-item>
            }
          </volt-dropdown-menu>
        </ng-template>

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

      <footer class="site-footer">
        <div class="footer-inner">
          <div class="footer-brand">
            <a class="flex items-center gap-3" [routerLink]="i18n.path('/')">
              <span class="brand-mark"><lmn-language [size]="20" /></span>
              <strong>Etyma</strong>
            </a>
            <p>{{ t('seo.tagline') }}</p>
            <p class="legal" data-testid="footer">{{ t('footer.rights', { year: year }) }}</p>
          </div>

          <nav class="footer-col" [attr.aria-label]="copy().footer.product">
            <h2>{{ copy().footer.product }}</h2>
            <a [routerLink]="i18n.path('/docs')">{{ t('nav.docs') }}</a>
            <a [routerLink]="i18n.path('/docs/button')">{{ t('docs.angularLink') }}</a>
            <a [routerLink]="i18n.path('/docs/themes')">{{ t('docs.analogLink') }}</a>
            <a [attr.href]="i18n.path('/') + '#faq'">{{ copy().nav.faq }}</a>
          </nav>

          <nav class="footer-col" [attr.aria-label]="copy().footer.project">
            <h2>{{ copy().footer.project }}</h2>
            <a [href]="repoUrl" target="_blank" rel="noopener">GitHub</a>
            <a [href]="repoUrl + '/releases'" target="_blank" rel="noopener">{{
              copy().footer.releases
            }}</a>
            <a [href]="repoUrl + '/issues'" target="_blank" rel="noopener">{{
              copy().footer.issues
            }}</a>
            <a [href]="repoUrl + '/blob/main/LICENSE'" target="_blank" rel="noopener">{{
              copy().footer.license
            }}</a>
          </nav>

          <nav class="footer-col" [attr.aria-label]="copy().footer.languages">
            <h2>{{ copy().footer.languages }}</h2>
            @for (locale of i18n.locales; track locale) {
              <a
                [attr.href]="i18n.path('/', locale)"
                [attr.hreflang]="locale"
                [attr.lang]="locale"
                [attr.aria-current]="locale === i18n.locale() ? 'true' : null"
                >{{ nameOf(locale) }}</a
              >
            }
          </nav>
        </div>
        <p class="footer-stack">{{ t('footer.stack') }}</p>
      </footer>
    </div>
  `,
})
export class App {
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);

  protected readonly i18n = injectAppI18n();
  protected readonly repoUrl = 'https://github.com/Andersseen/etyma';
  protected readonly theme = signal<'dark' | 'light'>('dark');
  protected readonly themeAriaLabel = computed(() => `Switch to ${this.oppositeTheme()} theme`);
  protected readonly showBackToTop = signal(false);
  protected readonly copy = computed(() => siteCopy(this.i18n.locale()));
  protected readonly mobileLinks = computed(() => {
    const home = this.i18n.path('/');

    return [
      { href: `${home}#features`, label: this.t('nav.features') },
      { href: `${home}#workflow`, label: this.t('nav.workflow') },
      { href: `${home}#start`, label: this.copy().nav.start },
      { href: `${home}#tooling`, label: this.t('nav.tooling') },
      { href: `${home}#packages`, label: this.t('nav.packages') },
      { href: `${home}#faq`, label: this.copy().nav.faq },
      { href: this.i18n.path('/docs'), label: this.t('nav.docs') },
    ];
  });

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
    // In the browser the inline script in index.html has already applied the stored or
    // system theme before first paint; starting from it keeps hydration from flashing dark.
    const painted = this.document.documentElement.getAttribute('data-theme');
    this.applyTheme(
      this.document.defaultView !== null && painted === 'light' ? 'light' : 'dark',
      false,
    );

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

  /** Mobile menu entries are plain URLs, some with a fragment the router must keep. */
  protected go(href: string): void {
    void this.router.navigateByUrl(href);
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
