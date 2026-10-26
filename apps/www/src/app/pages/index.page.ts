import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  VoltAccordion,
  VoltAccordionContent,
  VoltAccordionItem,
  VoltAccordionTrigger,
  VoltBadge,
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
  VoltNativeButton,
  VoltTabs,
  VoltTabsContent,
  VoltTabsList,
  VoltTabsTrigger,
} from '@voltui/components';
import {
  MoveHoverDirective,
  MoveInViewDirective,
  MoveStaggerDirective,
  MoveTapDirective,
} from 'angular-movement';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { LmnArrowTopRightOnSquareIcon } from 'lumen-icons/arrow-top-right-on-square';
import { LmnBoltIcon } from 'lumen-icons/bolt';
import { LmnCheckIcon } from 'lumen-icons/check';
import { LmnCheckCircleIcon } from 'lumen-icons/check-circle';
import { LmnCloudArrowUpIcon } from 'lumen-icons/cloud-arrow-up';
import { LmnCodeBracketSquareIcon } from 'lumen-icons/code-bracket-square';
import { LmnCommandLineIcon } from 'lumen-icons/command-line';
import { LmnGlobeAltIcon } from 'lumen-icons/globe-alt';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnPuzzlePieceIcon } from 'lumen-icons/puzzle-piece';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';
import { LmnShieldCheckIcon } from 'lumen-icons/shield-check';
import { LmnSignalIcon } from 'lumen-icons/signal';
import { LmnXMarkIcon } from 'lumen-icons/x-mark';

import { CopyButton } from '../components/copy-button';
import { LiveDemo } from '../components/live-demo';
import { siteCopy, type PackageName } from '../content/site-copy';
import contract from '../i18n/etyma.generated';
import { injectAppI18n } from '../i18n/inject';
import { injectPageSeo } from '../seo/page-seo';

const REPO_URL = 'https://github.com/Andersseen/etyma';

interface Framework {
  readonly id: 'angular' | 'analog' | 'astro';
  readonly name: string;
  readonly install: string;
  readonly setup: string;
  readonly usage: string;
}

const DEFINE_SAMPLE = `// i18n.ts
import { defineI18n } from '@etyma/core';
import en from './en.json';

export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: en,
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json'),
  },
});`;

const FRAMEWORKS: readonly Framework[] = [
  {
    id: 'angular',
    name: 'Angular',
    install: 'pnpm add @etyma/core @etyma/angular',
    setup: DEFINE_SAMPLE,
    usage: `// app.config.ts
providers: [provideZonelessChangeDetection(), provideEtyma(i18n)]

// any component
protected readonly i18n = injectI18n(i18n);
protected readonly t = this.i18n.t;

// template
<h1>{{ t('home.title') }}</h1>
<p>{{ t('inbox.count', { count: 3 }) }}</p>`,
  },
  {
    id: 'analog',
    name: 'AnalogJS',
    install: 'pnpm add @etyma/core @etyma/angular @etyma/analog',
    setup: DEFINE_SAMPLE,
    usage: `// app.config.ts
providers: [
  provideZonelessChangeDetection(),
  provideFileRouter(withLocalizedRoutes()),
  provideClientHydration(withEventReplay()),
  provideEtyma(i18n),
  provideEtymaAnalog(), // lang, dir, canonical, hreflang
]`,
  },
  {
    id: 'astro',
    name: 'Astro',
    install: 'pnpm add @etyma/core @etyma/astro',
    setup: DEFINE_SAMPLE,
    usage: `---
// src/pages/blog.astro
import { createAstroI18n } from '@etyma/astro';
import { i18n } from '../i18n';

const etyma = await createAstroI18n(Astro, i18n);
---
<html lang={etyma.locale} dir={etyma.direction}>
  <h1>{etyma.t('blog.title')}</h1>
</html>`,
  },
];

const PACKAGES: readonly PackageName[] = ['core', 'angular', 'analog', 'astro', 'tooling', 'cli'];

@Component({
  selector: 'app-home-page',
  imports: [
    RouterLink,
    VoltAccordion,
    VoltAccordionContent,
    VoltAccordionItem,
    VoltAccordionTrigger,
    VoltBadge,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    VoltNativeButton,
    VoltTabs,
    VoltTabsContent,
    VoltTabsList,
    VoltTabsTrigger,
    MoveHoverDirective,
    MoveInViewDirective,
    MoveStaggerDirective,
    MoveTapDirective,
    CopyButton,
    LiveDemo,
    LmnArrowRightIcon,
    LmnArrowTopRightOnSquareIcon,
    LmnBoltIcon,
    LmnCheckIcon,
    LmnCheckCircleIcon,
    LmnCloudArrowUpIcon,
    LmnCodeBracketSquareIcon,
    LmnCommandLineIcon,
    LmnGlobeAltIcon,
    LmnLanguageIcon,
    LmnPuzzlePieceIcon,
    LmnServerStackIcon,
    LmnShieldCheckIcon,
    LmnSignalIcon,
    LmnXMarkIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hero -->
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-backdrop" aria-hidden="true">
        <div class="hero-aurora"></div>
        <div class="hero-grid"></div>
        @for (glyph of glyphs; track glyph.char) {
          <span
            class="hero-glyph"
            [style.--x]="glyph.x"
            [style.--y]="glyph.y"
            [style.--d]="glyph.delay"
            >{{ glyph.char }}</span
          >
        }
      </div>

      <div class="hero-copy">
        <a class="hero-badge" [href]="releasesUrl" target="_blank" rel="noopener">
          <span class="hero-badge-dot" aria-hidden="true"></span>
          {{ t('home.eyebrow') }}
          <lmn-arrow-right [size]="14" />
        </a>

        <h1 id="hero-title" data-testid="title">
          @for (line of titleLines(); track $index; let last = $last) {
            <span class="hero-line" [class.hero-line-accent]="last" [style.--i]="$index">{{
              line
            }}</span
            >{{ last ? '' : ' ' }}
          }
        </h1>

        <p class="hero-lede" data-testid="lede">{{ t('home.lede') }}</p>

        <div class="hero-actions">
          <a
            voltButton
            size="lg"
            href="#start"
            data-testid="hero-primary"
            moveWhileHover="lift"
            moveWhileTap="press"
          >
            {{ copy().hero.getStarted }}
            <lmn-arrow-right [size]="20" />
          </a>
          <a
            voltButton
            variant="outline"
            size="lg"
            href="#packages"
            moveWhileHover="lift"
            moveWhileTap="press"
          >
            {{ t('home.secondaryCta') }}
          </a>
        </div>

        <div class="install-pill" data-testid="install">
          <span aria-hidden="true">$</span>
          <code>{{ installCommand }}</code>
          <app-copy-button
            [text]="installCommand"
            [label]="copy().hero.copy"
            [copiedLabel]="copy().hero.copied"
          />
        </div>

        <dl class="proof-grid">
          <div>
            <dt>Angular</dt>
            <dd>{{ t('home.angular') }}</dd>
          </div>
          <div>
            <dt>AnalogJS</dt>
            <dd>{{ t('home.analog') }}</dd>
          </div>
          <div>
            <dt>Astro</dt>
            <dd>{{ t('home.astro') }}</dd>
          </div>
          <div>
            <dt>{{ t('home.localesHeading') }}</dt>
            <dd>EN · ES · UK</dd>
          </div>
        </dl>
      </div>

      <div class="hero-demo">
        <app-live-demo [locale]="i18n.locale()" />
        <p class="hero-demo-hint">{{ copy().hero.demoHint }}</p>
      </div>
    </section>

    <!-- Stack strip -->
    <section class="stack-strip" aria-label="Supported stack">
      <p>{{ copy().stack.title }}</p>
      <ul>
        @for (item of stack; track item) {
          <li>{{ item }}</li>
        }
      </ul>
    </section>

    <!-- Before / after -->
    <section class="section" id="compare" aria-labelledby="compare-title">
      <div class="section-heading centered" moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{
          copy().compare.eyebrow
        }}</volt-badge>
        <h2 id="compare-title">{{ copy().compare.title }}</h2>
        <p>{{ copy().compare.body }}</p>
      </div>

      <div class="compare">
        <div class="compare-head" aria-hidden="true">
          <span class="is-before">{{ copy().compare.before }}</span>
          <span class="is-after">{{ copy().compare.after }}</span>
        </div>
        <ul class="compare-rows" moveStagger moveStaggerStep="70ms">
          @for (row of copy().compare.rows; track $index) {
            <li moveInView="fade-up">
              <p class="is-before">
                <lmn-x-mark [size]="20" aria-hidden="true" />
                <span class="sr-only">{{ copy().compare.before }}: </span>{{ row.before }}
              </p>
              <p class="is-after">
                <lmn-check [size]="20" aria-hidden="true" />
                <span class="sr-only">{{ copy().compare.after }}: </span>{{ row.after }}
              </p>
            </li>
          }
        </ul>
      </div>
    </section>

    <!-- Features bento -->
    <section class="section" id="features" aria-labelledby="features-title">
      <div class="section-heading" moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{ t('home.whyEyebrow') }}</volt-badge>
        <h2 id="features-title">{{ t('home.whyTitle') }}</h2>
        <p data-testid="tagline">{{ t('seo.tagline') }}</p>
      </div>

      <div class="bento" moveStagger moveStaggerStep="60ms">
        <volt-card class="bento-typed" moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-language [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.featureTypedTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.featureTypedBody') }}</volt-card-description>
          </volt-card-header>
          <volt-card-content>
            <pre
              class="bento-code"
              aria-hidden="true"
            ><code><span class="tok-fn">t</span>(<span class="tok-str">'checkout.total'</span>, {{ '{' }} <span class="tok-key">amount</span>: <span class="squiggle">'12'</span> {{ '}' }});
<span class="tok-err">✕ Type 'string' is not assignable to type 'number'.</span></code></pre>
          </volt-card-content>
        </volt-card>
        <volt-card class="bento-ssr" moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-server-stack [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.featureSsrTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.featureSsrBody') }}</volt-card-description>
          </volt-card-header>
          <volt-card-content>
            <div class="ssr-flow" aria-hidden="true">
              <span>SSR</span><i></i><span>HTML · es</span><i></i><span>hydrate ✓</span>
            </div>
          </volt-card-content>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-globe-alt [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              copy().features.routesTitle
            }}</volt-card-title>
            <volt-card-description>{{ copy().features.routesBody }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-code-bracket-square [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              copy().features.mf2Title
            }}</volt-card-title>
            <volt-card-description>{{ copy().features.mf2Body }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-cloud-arrow-up [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.featureCloudTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.featureCloudBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-puzzle-piece [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              copy().features.remoteTitle
            }}</volt-card-title>
            <volt-card-description>{{ copy().features.remoteBody }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card class="bento-wide" moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-signal [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              copy().features.signalsTitle
            }}</volt-card-title>
            <volt-card-description>{{ copy().features.signalsBody }}</volt-card-description>
          </volt-card-header>
        </volt-card>
      </div>
    </section>

    <!-- Types -->
    <section class="section split" id="types" aria-labelledby="types-title">
      <div moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{
          t('home.typesEyebrow')
        }}</volt-badge>
        <h2 id="types-title">{{ t('home.typesTitle') }}</h2>
        <p>{{ t('home.typesBody') }}</p>
      </div>
      <div class="editor" moveInView="fade-left" aria-label="TypeScript errors caught by Etyma">
        <div class="editor-tab"><span>home.component.ts</span></div>
        <pre><code>@for (line of typeLines; track $index) {<span class="editor-line" [class.has-error]="line.error"><span class="editor-no" aria-hidden="true">{{ $index + 1 }}</span><span [class.squiggle]="line.error">{{ line.code }}</span>@if (line.error) {<span class="editor-error">{{ line.error }}</span>}</span>
}</code></pre>
      </div>
    </section>

    <!-- Workflow -->
    <section class="section" id="workflow" aria-labelledby="workflow-title">
      <div class="section-heading centered" moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{
          t('home.workflowEyebrow')
        }}</volt-badge>
        <h2 id="workflow-title">{{ t('home.workflowTitle') }}</h2>
        <p>{{ t('home.workflowBody') }}</p>
      </div>

      <ol class="steps" moveStagger moveStaggerStep="110ms">
        <li moveInView="fade-up">
          <span class="step-no">01</span>
          <h3>{{ t('home.stepCatalogTitle') }}</h3>
          <p>{{ t('home.stepCatalogBody') }}</p>
        </li>
        <li moveInView="fade-up">
          <span class="step-no">02</span>
          <h3>{{ t('home.stepRouteTitle') }}</h3>
          <p>{{ t('home.stepRouteBody') }}</p>
        </li>
        <li moveInView="fade-up">
          <span class="step-no">03</span>
          <h3>{{ t('home.stepHydrateTitle') }}</h3>
          <p>{{ t('home.stepHydrateBody') }}</p>
        </li>
      </ol>
    </section>

    <!-- Quick start -->
    <section class="section" id="start" aria-labelledby="start-title">
      <div class="section-heading" moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{ copy().start.eyebrow }}</volt-badge>
        <h2 id="start-title">{{ copy().start.title }}</h2>
        <p>{{ copy().start.body }}</p>
      </div>

      <volt-tabs class="start-tabs" value="analog" moveInView="fade-up">
        <volt-tabs-list class="start-tablist" aria-label="Framework">
          @for (framework of frameworks; track framework.id) {
            <volt-tabs-trigger [value]="framework.id" [attr.data-testid]="'start-' + framework.id">
              {{ framework.name }}
            </volt-tabs-trigger>
          }
        </volt-tabs-list>

        @for (framework of frameworks; track framework.id) {
          <volt-tabs-content [value]="framework.id" class="start-panel">
            <div class="start-step">
              <div class="start-step-head">
                <span class="step-no">1</span>
                <h3>{{ copy().start.install }}</h3>
              </div>
              <div class="install-pill wide">
                <span aria-hidden="true">$</span>
                <code>{{ framework.install }}</code>
                <app-copy-button
                  [text]="framework.install"
                  [label]="copy().hero.copy"
                  [copiedLabel]="copy().hero.copied"
                />
              </div>
            </div>
            <div class="start-step">
              <div class="start-step-head">
                <span class="step-no">2</span>
                <h3>{{ copy().start.define }}</h3>
              </div>
              <div class="code-frame">
                <app-copy-button
                  [text]="framework.setup"
                  [label]="copy().hero.copy"
                  [copiedLabel]="copy().hero.copied"
                />
                <pre><code>{{ framework.setup }}</code></pre>
              </div>
            </div>
            <div class="start-step">
              <div class="start-step-head">
                <span class="step-no">3</span>
                <h3>{{ copy().start.use }}</h3>
              </div>
              <div class="code-frame">
                <app-copy-button
                  [text]="framework.usage"
                  [label]="copy().hero.copy"
                  [copiedLabel]="copy().hero.copied"
                />
                <pre><code>{{ framework.usage }}</code></pre>
              </div>
            </div>
          </volt-tabs-content>
        }
      </volt-tabs>

      <a class="text-link start-docs" [routerLink]="i18n.path('/docs')">
        {{ copy().start.docs }} <lmn-arrow-right [size]="16" />
      </a>
    </section>

    <!-- Tooling -->
    <section class="section split" id="tooling" aria-labelledby="tooling-title">
      <div moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{
          t('home.toolingEyebrow')
        }}</volt-badge>
        <h2 id="tooling-title">{{ t('home.toolingTitle') }}</h2>
        <p>{{ t('home.toolingBody') }}</p>
      </div>
      <div class="terminal" moveInView="fade-left">
        <div class="terminal-bar" aria-hidden="true">
          <i></i><i></i><i></i>
          <span><lmn-command-line [size]="14" /> ci.sh</span>
        </div>
        <pre><code><span class="tok-dim"># validate every locale against the source</span>
<span class="tok-prompt">$</span> etyma validate --remote "{{ remotePattern }}" \\
    --locales en,es,uk --source en
<span class="tok-ok">✓ 3 locales</span>
<span class="tok-ok">✓ {{ messageCount }} messages</span>
<span class="tok-ok">✓ Catalogs are valid</span>

<span class="tok-prompt">$</span> pnpm typecheck &amp;&amp; pnpm build</code></pre>
      </div>
    </section>

    <section class="section tool-cards" aria-label="Tooling">
      <div class="feature-grid" moveStagger moveStaggerStep="80ms">
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-check-circle [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.toolingValidateTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.toolingValidateBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-code-bracket-square [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.toolingContractTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.toolingContractBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card moveInView="fade-up" moveWhileHover="lift">
          <volt-card-header>
            <lmn-shield-check [size]="24" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('home.toolingCheckTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('home.toolingCheckBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
      </div>
    </section>

    <!-- Packages -->
    <section class="section" id="packages" aria-labelledby="packages-title">
      <div class="section-heading" moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{
          t('home.packagesEyebrow')
        }}</volt-badge>
        <h2 id="packages-title">{{ t('home.packagesTitle') }}</h2>
        <p>{{ t('home.packagesBody') }}</p>
      </div>

      <ul class="package-grid" moveStagger moveStaggerStep="60ms">
        @for (name of packages; track name) {
          <li moveInView="fade-up">
            <a
              class="package-card"
              [href]="'https://www.npmjs.com/package/@etyma/' + name"
              target="_blank"
              rel="noopener"
              moveWhileHover="lift"
            >
              <span class="package-name">&#64;etyma/{{ name }}</span>
              <span class="package-body">{{ copy().packages.descriptions[name] }}</span>
              <span class="package-link"
                >{{ copy().packages.npm }} <lmn-arrow-top-right-on-square [size]="14"
              /></span>
            </a>
          </li>
        }
      </ul>
    </section>

    <!-- Stability -->
    <section class="section" id="stability" aria-labelledby="stability-title">
      <div class="stability">
        <div class="section-heading" moveInView="fade-up">
          <volt-badge variant="outline" class="section-badge">{{
            t('home.stabilityEyebrow')
          }}</volt-badge>
          <h2 id="stability-title">{{ t('home.stabilityTitle') }}</h2>
          <p>{{ t('home.stabilityBody') }}</p>
        </div>
        <div class="stability-grid" moveStagger moveStaggerStep="70ms">
          <volt-card moveInView="fade-up">
            <volt-card-header>
              <lmn-check-circle [size]="24" class="self-start text-primary" />
              <volt-card-title role="heading" aria-level="3">{{
                t('home.stabilityApiTitle')
              }}</volt-card-title>
              <volt-card-description>{{ t('home.stabilityApiBody') }}</volt-card-description>
            </volt-card-header>
          </volt-card>
          <volt-card moveInView="fade-up">
            <volt-card-header>
              <lmn-code-bracket-square [size]="24" class="self-start text-primary" />
              <volt-card-title role="heading" aria-level="3">{{
                t('home.stabilityContractTitle')
              }}</volt-card-title>
              <volt-card-description>{{ t('home.stabilityContractBody') }}</volt-card-description>
            </volt-card-header>
          </volt-card>
          <volt-card moveInView="fade-up">
            <volt-card-header>
              <lmn-shield-check [size]="24" class="self-start text-primary" />
              <volt-card-title role="heading" aria-level="3">{{
                t('home.stabilityDiagnosticsTitle')
              }}</volt-card-title>
              <volt-card-description>{{
                t('home.stabilityDiagnosticsBody')
              }}</volt-card-description>
            </volt-card-header>
          </volt-card>
          <volt-card moveInView="fade-up">
            <volt-card-header>
              <lmn-bolt [size]="24" class="self-start text-primary" />
              <volt-card-title role="heading" aria-level="3">{{
                t('home.stabilityCliTitle')
              }}</volt-card-title>
              <volt-card-description>{{ t('home.stabilityCliBody') }}</volt-card-description>
            </volt-card-header>
          </volt-card>
        </div>
      </div>
    </section>

    <!-- FAQ -->
    <section class="section split faq" id="faq" aria-labelledby="faq-title">
      <div moveInView="fade-up">
        <volt-badge variant="outline" class="section-badge">{{ copy().faq.eyebrow }}</volt-badge>
        <h2 id="faq-title">{{ copy().faq.title }}</h2>
      </div>
      <volt-accordion class="faq-list" type="single" [collapsible]="true" value="faq-0">
        @for (item of copy().faq.items; track $index) {
          <volt-accordion-item [value]="'faq-' + $index">
            <volt-accordion-trigger>{{ item.question }}</volt-accordion-trigger>
            <volt-accordion-content>
              <p>{{ item.answer }}</p>
            </volt-accordion-content>
          </volt-accordion-item>
        }
      </volt-accordion>
    </section>

    <!-- CTA -->
    <section class="section cta" aria-labelledby="cta-title" moveInView="zoom-in">
      <div class="cta-glow" aria-hidden="true"></div>
      <h2 id="cta-title">{{ t('home.ctaTitle') }}</h2>
      <p>{{ t('home.ctaBody') }}</p>
      <div class="hero-actions">
        <a
          voltButton
          size="lg"
          [routerLink]="i18n.path('/docs')"
          data-testid="cta-docs"
          moveWhileHover="lift"
          moveWhileTap="press"
        >
          {{ t('home.ctaPrimary') }}
        </a>
        <a
          voltButton
          variant="outline"
          size="lg"
          [href]="repoUrl"
          rel="noopener"
          moveWhileHover="lift"
          moveWhileTap="press"
        >
          {{ t('home.ctaSecondary') }}
        </a>
      </div>
    </section>
  `,
})
export default class HomePage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
  protected readonly copy = computed(() => siteCopy(this.i18n.locale()));

  protected readonly repoUrl = REPO_URL;
  protected readonly releasesUrl = `${REPO_URL}/releases`;
  protected readonly installCommand = 'pnpm add @etyma/core @etyma/angular';
  protected readonly remotePattern = 'https://glossa.andersseen.dev/i18n/etyma-www/{locale}.json';
  protected readonly messageCount = contract.keys.length;
  protected readonly frameworks = FRAMEWORKS;
  protected readonly packages = PACKAGES;
  protected readonly stack = [
    'Angular',
    'AnalogJS',
    'Astro',
    'MessageFormat 2',
    'Vite',
    'Cloudflare',
    'TypeScript',
  ];

  /** One word per script, drifting behind the hero. Decorative only. */
  protected readonly glyphs = [
    { char: 'Hola', x: '47%', y: '88%', delay: '0s' },
    { char: 'Привіт', x: '86%', y: '6%', delay: '-4s' },
    { char: 'Bonjour', x: '2%', y: '92%', delay: '-8s' },
    { char: 'こんにちは', x: '50%', y: '10%', delay: '-2s' },
    { char: 'مرحبا', x: '94%', y: '86%', delay: '-6s' },
    { char: 'Hallo', x: '30%', y: '4%', delay: '-10s' },
  ];

  /** The title's sentences, each revealed on its own line; the last carries the accent. */
  protected readonly titleLines = computed(() =>
    this.t('home.title')
      .split(/(?<=[.!?])\s+/)
      .filter(line => line.length > 0),
  );

  protected readonly typeLines: readonly { code: string; error?: string }[] = [
    { code: 'const { t } = injectI18n(i18n);' },
    { code: '' },
    { code: "t('home.title');" },
    {
      code: "t('home.titel');",
      error: `Argument of type '"home.titel"' is not assignable to parameter of type MessageKey.`,
    },
    { code: "t('footer.rights');", error: "Expected 2 arguments, but got 1. 'year' is required." },
    {
      code: "t('footer.rights', { year: 'x' });",
      error: "Type 'string' is not assignable to type 'number'.",
    },
    { code: "t('footer.rights', { year: 2026 });" },
  ];

  constructor() {
    injectPageSeo(() => {
      const copy = this.copy();
      const title = `${this.t('seo.siteName')} — ${this.t('seo.tagline')}`;

      return {
        title,
        description: copy.seo.description,
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareSourceCode',
            name: 'Etyma',
            description: copy.seo.description,
            codeRepository: REPO_URL,
            programmingLanguage: 'TypeScript',
            runtimePlatform: ['Angular', 'AnalogJS', 'Astro'],
            license: 'https://opensource.org/licenses/MIT',
            inLanguage: this.i18n.locale(),
          },
          {
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            inLanguage: this.i18n.locale(),
            mainEntity: copy.faq.items.map(item => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: { '@type': 'Answer', text: item.answer },
            })),
          },
        ],
      };
    });
  }
}
