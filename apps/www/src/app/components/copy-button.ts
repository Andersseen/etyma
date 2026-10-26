import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { MoveTapDirective } from 'angular-movement';
import { LmnCheckIcon } from 'lumen-icons/check';
import { LmnClipboardDocumentIcon } from 'lumen-icons/clipboard-document';

/** Copies `text` and says so for a moment. The label comes from the page's language. */
@Component({
  selector: 'app-copy-button',
  imports: [MoveTapDirective, LmnCheckIcon, LmnClipboardDocumentIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="copy-button"
      moveWhileTap="press"
      [attr.aria-label]="copied() ? copiedLabel() : label()"
      [attr.data-copied]="copied() ? '' : null"
      (click)="copy()"
    >
      @if (copied()) {
        <lmn-check [size]="16" />
      } @else {
        <lmn-clipboard-document [size]="16" />
      }
      <span class="sr-only" aria-live="polite">{{ copied() ? copiedLabel() : '' }}</span>
    </button>
  `,
})
export class CopyButton {
  readonly text = input.required<string>();
  readonly label = input('Copy');
  readonly copiedLabel = input('Copied');

  protected readonly copied = signal(false);

  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
    });
  }

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
    } catch {
      return;
    }

    this.copied.set(true);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.copied.set(false);
    }, 1800);
  }
}
