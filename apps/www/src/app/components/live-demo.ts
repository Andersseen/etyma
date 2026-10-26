import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { createMessageFormatter, type Locale } from '@etyma/core';
import {
  VoltSlider,
  VoltTabs,
  VoltTabsContent,
  VoltTabsList,
  VoltTabsTrigger,
} from '@voltui/components';
import { MoveAnimateDirective, MoveLoopDirective } from 'angular-movement';
import { LmnLockClosedIcon } from 'lumen-icons/lock-closed';

import { siteCopy } from '../content/site-copy';

type DemoLocale = 'en' | 'es' | 'uk';

interface DemoCatalog {
  readonly label: string;
  readonly greeting: string;
  readonly inbox: string;
  readonly updated: string;
  readonly plan: string;
}

/**
 * The demo's own catalogs. They are written in MessageFormat 2 and formatted by the same
 * `createMessageFormatter` the runtime uses, so what the visitor sees is real output - the
 * Ukrainian `few` / `many` split included.
 */
const CATALOGS: Readonly<Record<DemoLocale, DemoCatalog>> = {
  en: {
    label: 'EN',
    greeting: 'Welcome back, {$name}!',
    inbox: `.input {$count :number}
.match $count
one {{You have {$count} new message}}
*   {{You have {$count} new messages}}`,
    updated: 'Updated {$when :date style=long}',
    plan: 'Pro plan · {$price :currency currency=EUR}/month',
  },
  es: {
    label: 'ES',
    greeting: '¡Hola de nuevo, {$name}!',
    inbox: `.input {$count :number}
.match $count
one {{Tienes {$count} mensaje nuevo}}
*   {{Tienes {$count} mensajes nuevos}}`,
    updated: 'Actualizado el {$when :date style=long}',
    plan: 'Plan Pro · {$price :currency currency=EUR}/mes',
  },
  uk: {
    label: 'UK',
    greeting: 'З поверненням, {$name}!',
    inbox: `.input {$count :number}
.match $count
one  {{У вас {$count} нове повідомлення}}
few  {{У вас {$count} нові повідомлення}}
many {{У вас {$count} нових повідомлень}}
*    {{У вас {$count} нового повідомлення}}`,
    updated: 'Оновлено {$when :date style=long}',
    plan: 'План Pro · {$price :currency currency=EUR}/міс.',
  },
};

const LOCALES = Object.keys(CATALOGS) as DemoLocale[];

const SOURCE_LINES = Math.max(...LOCALES.map(locale => CATALOGS[locale].inbox.split('\n').length));

/** Counts that land on a different plural category in at least one language. */
const TOUR = [1, 3, 5, 21, 0, 12];

/** Noon UTC is the same calendar day in every time zone a server or visitor is likely in. */
const WHEN = new Date(Date.UTC(2026, 9, 26, 12));

const formatter = createMessageFormatter();

interface SourceLine {
  readonly text: string;
  readonly matched: boolean;
}

@Component({
  selector: 'app-live-demo',
  imports: [
    VoltSlider,
    VoltTabs,
    VoltTabsContent,
    VoltTabsList,
    VoltTabsTrigger,
    MoveAnimateDirective,
    MoveLoopDirective,
    LmnLockClosedIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="demo" data-testid="live-demo">
      <div class="demo-chrome">
        <span class="demo-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <div class="demo-url" data-testid="demo-url">
          <lmn-lock-closed [size]="14" aria-hidden="true" />
          <span class="demo-host">acme.app</span><span class="demo-path">{{ path() }}</span>
        </div>
        <code class="demo-lang">lang="{{ active() }}"</code>
      </div>

      <volt-tabs class="demo-tabs" [value]="active()" (valueChange)="choose($event)">
        <div class="demo-toolbar">
          <volt-tabs-list class="demo-locales" [attr.aria-label]="copy().demoLabel">
            @for (locale of locales; track locale) {
              <volt-tabs-trigger [value]="locale" [attr.data-testid]="'demo-' + locale">
                {{ catalogs[locale].label }}
              </volt-tabs-trigger>
            }
          </volt-tabs-list>
          <span class="demo-live"
            ><i aria-hidden="true" moveLoop="pulse" moveDuration="1800"></i
            >{{ copy().demoLabel }}</span
          >
        </div>

        @for (locale of locales; track locale) {
          <volt-tabs-content [value]="locale" class="demo-panel">
            <div class="demo-screen" [attr.lang]="locale">
              <!-- Only the visible panel animates; a hidden one has nothing to commit to. -->
              @for (view of locale === active() ? [render(locale)] : []; track view.key) {
                <p
                  class="demo-greeting"
                  [moveInitial]="{ opacity: 0 }"
                  [moveAnimate]="{ opacity: 1 }"
                  moveDuration="260"
                >
                  {{ view.greeting }}
                </p>
                <p
                  class="demo-inbox"
                  data-testid="demo-inbox"
                  [moveInitial]="{ opacity: 0 }"
                  [moveAnimate]="{ opacity: 1 }"
                  moveDuration="260"
                >
                  {{ view.inbox }}
                </p>
                <div class="demo-meta">
                  <span>{{ view.plan }}</span>
                  <span>{{ view.updated }}</span>
                </div>
              }
            </div>
          </volt-tabs-content>
        }
      </volt-tabs>

      <div class="demo-control">
        <label [attr.for]="sliderId">{{ copy().countLabel }}</label>
        <volt-slider
          [id]="sliderId"
          [value]="count()"
          [min]="0"
          [max]="25"
          [ariaLabel]="copy().countLabel"
          (valueChange)="setCount($event)"
        />
        <output class="demo-count" [attr.for]="sliderId">{{ count() }}</output>
      </div>

      <div class="demo-source">
        <div class="demo-source-head">
          <span>{{ copy().source }}</span>
          <span class="demo-match"
            >{{ copy().matched }}: <strong>{{ category() }}</strong></span
          >
        </div>
        <pre><code>@for (line of source(); track $index) {<span [class.is-match]="line.matched">{{ line.text }}</span>
}</code></pre>
      </div>
    </div>
  `,
})
export class LiveDemo {
  /** The page's language, which the demo starts in. */
  readonly locale = input.required<Locale>();

  protected readonly locales = LOCALES;
  protected readonly catalogs = CATALOGS;
  protected readonly sliderId = 'demo-count';
  protected readonly copy = computed(() => siteCopy(this.locale()).hero);

  protected readonly active = linkedSignal<DemoLocale>(() =>
    LOCALES.includes(this.locale() as DemoLocale) ? (this.locale() as DemoLocale) : 'en',
  );
  protected readonly count = signal(3);

  protected readonly path = computed(
    () => (this.active() === 'en' ? '' : `/${this.active()}`) + '/inbox',
  );

  protected readonly category = computed(() =>
    new Intl.PluralRules(this.active()).select(this.count()),
  );

  /** The source of the active catalog, with the variant MessageFormat picked marked. */
  protected readonly source = computed<readonly SourceLine[]>(() => {
    const lines = CATALOGS[this.active()].inbox.split('\n');
    const variants = lines
      .filter(line => /^\S+\s+\{\{/.test(line))
      .map(line => line.split(/\s/)[0]);
    const pick = variants.includes(this.category()) ? this.category() : '*';

    const shown = lines.map(text => ({
      text,
      matched: text.split(/\s/)[0] === pick && text.includes('{{'),
    }));

    // Pad to the tallest catalog so switching language never resizes the demo.
    while (shown.length < SOURCE_LINES) {
      shown.push({ text: '\u00a0', matched: false });
    }

    return shown;
  });

  private interacted = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    // A short tour of languages and plural categories catches the eye; it stops the moment
    // the visitor touches the demo, and never runs for anyone who asked for less motion.
    afterNextRender(() => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return;
      }

      let step = 0;
      const timer = window.setInterval(() => {
        if (this.interacted || document.hidden) {
          return;
        }

        step += 1;
        this.active.set(LOCALES[step % LOCALES.length] ?? 'en');
        this.count.set(TOUR[step % TOUR.length] ?? 3);
      }, 3200);

      destroyRef.onDestroy(() => {
        window.clearInterval(timer);
      });
    });
  }

  protected render(locale: DemoLocale) {
    const catalog = CATALOGS[locale];
    const count = this.count();
    const format = (key: string, source: string, params: Record<string, unknown>) =>
      formatter.format(locale, key, source, params as never);

    return {
      key: `${locale}:${count}`,
      greeting: format('greeting', catalog.greeting, { name: siteCopy(locale).hero.userName }),
      inbox: format('inbox', catalog.inbox, { count }),
      updated: format('updated', catalog.updated, { when: WHEN }),
      plan: format('plan', catalog.plan, { price: 29 }),
    };
  }

  protected choose(locale: string | undefined): void {
    if (locale !== undefined && LOCALES.includes(locale as DemoLocale)) {
      this.interacted = true;
      this.active.set(locale as DemoLocale);
    }
  }

  protected setCount(value: number): void {
    this.interacted = true;
    this.count.set(Math.round(value));
  }
}
