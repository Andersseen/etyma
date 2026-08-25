import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  VoltBadge,
  VoltButton,
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from '@voltui/components';
import { MOVEMENT_DIRECTIVES } from 'angular-movement';
import { LmnCheckCircleIcon } from 'lumen-icons/check-circle';
import { LmnCloudArrowUpIcon } from 'lumen-icons/cloud-arrow-up';
import { LmnCodeBracketSquareIcon } from 'lumen-icons/code-bracket-square';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnServerStackIcon } from 'lumen-icons/server-stack';
import { LmnShieldCheckIcon } from 'lumen-icons/shield-check';

import { injectAppI18n } from '../i18n/inject';

@Component({
  selector: 'app-home-page',
  imports: [
    VoltBadge,
    VoltButton,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    ...MOVEMENT_DIRECTIVES,
    LmnCheckCircleIcon,
    LmnCloudArrowUpIcon,
    LmnCodeBracketSquareIcon,
    LmnLanguageIcon,
    LmnServerStackIcon,
    LmnShieldCheckIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <div
        class="hero-copy"
        [moveInitial]="{ opacity: 0, y: 28 }"
        [moveAnimate]="{ opacity: 1, y: 0 }"
        moveDuration="520"
      >
        <volt-badge variant="outline" class="hero-badge">{{ t('home.eyebrow') }}</volt-badge>
        <h1 data-testid="title">{{ t('home.title') }}</h1>
        <p class="hero-lede" data-testid="lede">{{ t('home.lede') }}</p>

        <div class="hero-actions">
          <a href="#workflow" data-testid="hero-primary">
            <volt-button class="primary-cta" size="lg">{{ t('home.primaryCta') }}</volt-button>
          </a>
          <a href="#packages">
            <volt-button variant="outline" size="lg">{{ t('home.secondaryCta') }}</volt-button>
          </a>
        </div>

        <dl class="proof-grid" moveStagger [moveStaggerStep]="70">
          <div [move]="'fade-up'">
            <dt>Angular</dt>
            <dd>{{ t('home.angular') }}</dd>
          </div>
          <div [move]="'fade-up'">
            <dt>AnalogJS</dt>
            <dd>{{ t('home.analog') }}</dd>
          </div>
          <div [move]="'fade-up'">
            <dt>{{ t('home.localesHeading') }}</dt>
            <dd>EN / ES / UK</dd>
          </div>
        </dl>
      </div>

      <volt-card
        class="hero-lab"
        aria-label="Etyma code preview"
        [moveInitial]="{ opacity: 0, scale: 0.96, y: 36 }"
        [moveAnimate]="{ opacity: 1, scale: 1, y: 0 }"
        moveDuration="620"
      >
        <volt-card-content class="lab-content">
          <div class="lab-topbar">
            <span></span>
            <span></span>
            <span></span>
            <strong>{{ t('home.codeTitle') }}</strong>
          </div>
          <pre><code>{{ codeSample }}</code></pre>
          <div class="route-stack" aria-hidden="true">
            <span>/docs <strong>EN</strong></span>
            <span>/es/docs <strong>ES</strong></span>
            <span>/uk/docs <strong>UK</strong></span>
          </div>
          <div class="ssr-card">
            <span>SSR</span>
            <strong>{{ t('home.codeNote') }}</strong>
          </div>
        </volt-card-content>
      </volt-card>
    </section>

    <section class="section" id="features">
      <div class="section-heading">
        <volt-badge variant="outline" class="section-badge">{{ t('home.whyEyebrow') }}</volt-badge>
        <h2>{{ t('home.whyTitle') }}</h2>
        <p data-testid="tagline">{{ t('seo.tagline') }}</p>
      </div>

      <div class="feature-grid" moveStagger [moveStaggerStep]="85">
        <volt-card class="feature-card" [move]="'fade-up'" [moveWhileHover]="{ y: [0, -4] }">
          <lmn-language [size]="24" />
          <volt-card-header>
            <volt-card-title>{{ t('home.featureTypedTitle') }}</volt-card-title>
            <volt-card-description>{{ t('home.featureTypedBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card class="feature-card" [move]="'fade-up'" [moveWhileHover]="{ y: [0, -4] }">
          <lmn-server-stack [size]="24" />
          <volt-card-header>
            <volt-card-title>{{ t('home.featureSsrTitle') }}</volt-card-title>
            <volt-card-description>{{ t('home.featureSsrBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card class="feature-card" [move]="'fade-up'" [moveWhileHover]="{ y: [0, -4] }">
          <lmn-cloud-arrow-up [size]="24" />
          <volt-card-header>
            <volt-card-title>{{ t('home.featureCloudTitle') }}</volt-card-title>
            <volt-card-description>{{ t('home.featureCloudBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
      </div>
    </section>

    <section class="section workflow" id="workflow">
      <div class="section-heading">
        <volt-badge variant="outline" class="section-badge">{{
          t('home.workflowEyebrow')
        }}</volt-badge>
        <h2>{{ t('home.workflowTitle') }}</h2>
        <p>{{ t('home.workflowBody') }}</p>
      </div>

      <div class="timeline" moveStagger [moveStaggerStep]="90">
        <volt-card [move]="'fade-up'">
          <span>01</span>
          <volt-card-title>{{ t('home.stepCatalogTitle') }}</volt-card-title>
          <volt-card-description>{{ t('home.stepCatalogBody') }}</volt-card-description>
        </volt-card>
        <volt-card [move]="'fade-up'">
          <span>02</span>
          <volt-card-title>{{ t('home.stepRouteTitle') }}</volt-card-title>
          <volt-card-description>{{ t('home.stepRouteBody') }}</volt-card-description>
        </volt-card>
        <volt-card [move]="'fade-up'">
          <span>03</span>
          <volt-card-title>{{ t('home.stepHydrateTitle') }}</volt-card-title>
          <volt-card-description>{{ t('home.stepHydrateBody') }}</volt-card-description>
        </volt-card>
      </div>
    </section>

    <section class="section split" id="packages">
      <div>
        <volt-badge variant="outline" class="section-badge">{{
          t('home.packagesEyebrow')
        }}</volt-badge>
        <h2>{{ t('home.packagesTitle') }}</h2>
        <p>{{ t('home.packagesBody') }}</p>
      </div>
      <volt-card class="package-list" [moveInView]="'fade-up'">
        <div><lmn-code-bracket-square [size]="20" /> <span>@etyma/core</span></div>
        <div><lmn-shield-check [size]="20" /> <span>@etyma/angular</span></div>
        <div><lmn-check-circle [size]="20" /> <span>@etyma/analog</span></div>
      </volt-card>
    </section>
  `,
})
export default class HomePage {
  private readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
  protected readonly codeSample = `const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: en,
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json')
  }
});`;
}
