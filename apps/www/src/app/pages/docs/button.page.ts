import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  VoltCard,
  VoltCardContent,
  VoltCardDescription,
  VoltCardHeader,
  VoltCardTitle,
} from '@voltui/components';
import { LmnArrowLeftIcon } from 'lumen-icons/arrow-left';
import { LmnCodeBracketSquareIcon } from 'lumen-icons/code-bracket-square';
import { LmnLanguageIcon } from 'lumen-icons/language';
import { LmnVariableIcon } from 'lumen-icons/variable';

import { injectAppI18n } from '../../i18n/inject';
import { injectPageSeo } from '../../seo/page-seo';

/** Fixed so the rendered date is the same in every run, and assertable. */
const RELEASED_ON = new Date(Date.UTC(2026, 0, 15, 12));

@Component({
  selector: 'app-button-page',
  imports: [
    VoltCard,
    VoltCardContent,
    VoltCardDescription,
    VoltCardHeader,
    VoltCardTitle,
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
      <volt-card>
        <volt-card-header>
          <lmn-language
            [size]="24"
            background="soft"
            backgroundTone="primary"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('button.signalsTitle')
          }}</volt-card-title>
          <volt-card-description>{{ t('button.signalsBody') }}</volt-card-description>
        </volt-card-header>
      </volt-card>
      <volt-card>
        <volt-card-header>
          <lmn-variable
            [size]="24"
            background="soft"
            backgroundTone="success"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('button.typesTitle')
          }}</volt-card-title>
          <volt-card-description>{{ t('button.typesBody') }}</volt-card-description>
        </volt-card-header>
      </volt-card>
      <volt-card>
        <volt-card-header>
          <lmn-code-bracket-square
            [size]="24"
            background="soft"
            backgroundTone="warning"
            class="self-start text-primary"
          />
          <volt-card-title role="heading" aria-level="2">{{
            t('button.mf2Title')
          }}</volt-card-title>
        </volt-card-header>
        <volt-card-content class="grid gap-2 text-sm text-muted-foreground">
          <p data-testid="status">{{ t('button.status', { state: 'stable' }) }}</p>
          <p data-testid="released">{{ t('button.released', { on: releasedOn }) }}</p>
        </volt-card-content>
      </volt-card>
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

  constructor() {
    injectPageSeo(() => ({
      title: `${this.t('button.title')} | ${this.t('seo.siteName')}`,
      description: this.t('button.lede'),
    }));
  }
}
