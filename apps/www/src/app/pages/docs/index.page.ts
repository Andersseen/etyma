import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LmnArrowRightIcon } from 'lumen-icons/arrow-right';
import { LmnCheckCircleIcon } from 'lumen-icons/check-circle';

import { injectAppI18n } from '../../i18n/inject';

@Component({
  selector: 'app-docs-page',
  imports: [RouterLink, LmnArrowRightIcon, LmnCheckCircleIcon],
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
        <article class="feature-card">
          <lmn-check-circle [size]="20" />
          <h3>{{ t('docs.routingTitle') }}</h3>
          <p>{{ t('docs.routingBody') }}</p>
        </article>
        <article class="feature-card">
          <lmn-check-circle [size]="20" />
          <h3>{{ t('docs.fallbackTitle') }}</h3>
          <p data-testid="fallback">{{ t('docs.sourceOnly') }}</p>
        </article>
        <article class="feature-card">
          <lmn-check-circle [size]="20" />
          <h3>{{ t('docs.messageTitle') }}</h3>
          <p data-testid="plural-one">{{ t('docs.componentCount', { count: 1 }) }}</p>
          <p data-testid="plural-few">{{ t('docs.componentCount', { count: 3 }) }}</p>
          <p data-testid="plural-many">{{ t('docs.componentCount', { count: 12 }) }}</p>
        </article>
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
}
