import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from '@voltui/components';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { LmnCheckCircleIcon } from 'lumen-icons/check-circle';

import { injectAppI18n } from '../../i18n/inject';
import { injectPageSeo } from '../../seo/page-seo';

@Component({
  selector: 'app-docs-page',
  imports: [
    RouterLink,
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
    LmnArrowRightIcon,
    LmnCheckCircleIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero compact" data-motion="rise">
      <p class="eyebrow">{{ t('docs.eyebrow') }}</p>
      <h1 data-testid="title">{{ t('docs.title') }}</h1>
      <p data-testid="lede">{{ t('docs.lede') }}</p>
    </section>

    <section class="section split">
      <div>
        <h2>{{ t('docs.setupTitle') }}</h2>
        <p>{{ t('docs.setupBody') }}</p>
      </div>
      <pre class="code-block"><code>{{ setupCode }}</code></pre>
    </section>

    <section class="section">
      <div class="feature-grid dense">
        <volt-card>
          <volt-card-header>
            <lmn-check-circle [size]="20" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('docs.routingTitle')
            }}</volt-card-title>
            <volt-card-description>{{ t('docs.routingBody') }}</volt-card-description>
          </volt-card-header>
        </volt-card>
        <volt-card>
          <volt-card-header>
            <lmn-check-circle [size]="20" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('docs.fallbackTitle')
            }}</volt-card-title>
          </volt-card-header>
          <volt-card-content class="grid gap-2 text-sm text-muted-foreground">
            <p data-testid="fallback">{{ t('docs.sourceOnly') }}</p>
          </volt-card-content>
        </volt-card>
        <volt-card>
          <volt-card-header>
            <lmn-check-circle [size]="20" class="self-start text-primary" />
            <volt-card-title role="heading" aria-level="3">{{
              t('docs.messageTitle')
            }}</volt-card-title>
          </volt-card-header>
          <volt-card-content class="grid gap-2 text-sm text-muted-foreground">
            <p data-testid="plural-one">{{ t('docs.componentCount', { count: 1 }) }}</p>
            <p data-testid="plural-few">{{ t('docs.componentCount', { count: 3 }) }}</p>
            <p data-testid="plural-many">{{ t('docs.componentCount', { count: 12 }) }}</p>
          </volt-card-content>
        </volt-card>
      </div>
    </section>

    <nav class="next-links" aria-label="Next">
      <a [routerLink]="i18n.path('/docs/button')" data-testid="to-button">
        {{ t('docs.angularLink') }} <lmn-arrow-right [size]="16" />
      </a>
      <a [routerLink]="i18n.path('/docs/themes')" data-testid="to-themes">
        {{ t('docs.analogLink') }} <lmn-arrow-right [size]="16" />
      </a>
    </nav>
  `,
})
export default class DocsPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
  protected readonly setupCode = `export const i18n = defineI18n({
  locales: ['en', 'es', 'uk'],
  sourceLocale: 'en',
  source: en,
  loaders: {
    es: () => import('./es.json'),
    uk: () => import('./uk.json')
  }
});`;

  constructor() {
    injectPageSeo(() => ({
      title: `${this.t('docs.title')} | ${this.t('seo.siteName')}`,
      description: this.t('docs.lede'),
    }));
  }
}
