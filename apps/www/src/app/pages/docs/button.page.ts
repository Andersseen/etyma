import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LmnArrowLeftIcon } from 'lumen-icons/arrow-left';
import { LmnCodeBracketSquareIcon } from 'lumen-icons/code-bracket-square';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnVariableIcon } from 'lumen-icons/variable';

import { injectAppI18n } from '../../i18n/inject';

/** Fixed so the rendered date is the same in every run, and assertable. */
const RELEASED_ON = new Date(Date.UTC(2026, 0, 15, 12));

@Component({
  selector: 'app-button-page',
  imports: [
    RouterLink,
    LmnArrowLeftIcon,
    LmnCodeBracketSquareIcon,
    LmnLanguageIcon,
    LmnVariableIcon,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page-hero compact" data-motion="rise">
      <p class="eyebrow">{{ t('button.eyebrow') }}</p>
      <h1 data-testid="title">{{ t('button.title') }}</h1>
      <p data-testid="lede">{{ t('button.lede') }}</p>
    </section>

    <section class="section feature-grid">
      <article class="feature-card">
        <lmn-language [size]="24" background="soft" backgroundTone="primary" />
        <h2>{{ t('button.signalsTitle') }}</h2>
        <p>{{ t('button.signalsBody') }}</p>
      </article>
      <article class="feature-card">
        <lmn-variable [size]="24" background="soft" backgroundTone="success" />
        <h2>{{ t('button.typesTitle') }}</h2>
        <p>{{ t('button.typesBody') }}</p>
      </article>
      <article class="feature-card">
        <lmn-code-bracket-square [size]="24" background="soft" backgroundTone="warning" />
        <h2>{{ t('button.mf2Title') }}</h2>
        <p data-testid="status">{{ t('button.status', { state: 'stable' }) }}</p>
        <p data-testid="released">{{ t('button.released', { on: releasedOn }) }}</p>
      </article>
    </section>

    <a class="text-link" [routerLink]="i18n.path('/docs')" data-testid="to-docs">
      <lmn-arrow-left [size]="16" />{{ t('button.back') }}
    </a>
  `,
})
export default class ButtonPage {
  protected readonly i18n = injectAppI18n();
  protected readonly t = this.i18n.t;
  protected readonly releasedOn = RELEASED_ON;
}
