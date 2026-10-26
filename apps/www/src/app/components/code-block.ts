import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  input,
  signal,
} from '@angular/core';

import { CopyButton } from './copy-button';

/** What one line, and the editor's own padding, measure at the 14px size set in `styles.css`. */
const LINE_HEIGHT = 19.6;
const EDITOR_PADDING = 8;
/** The frame's vertical padding, which `.code-frame` also sets. */
const FRAME_PADDING = 28;

let editorReady: Promise<void> | undefined;

/**
 * Loads Vertex's read-only editor once, on the first code block that asks for it.
 *
 * The bundle is a custom element that registers itself, so there is nothing to import; the
 * page keeps rendering the plain `<pre>` until the element exists.
 */
function loadEditor(): Promise<void> {
  editorReady ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');

    script.src = '/web-editor-lite.min.js';
    script.async = true;
    script.addEventListener('load', () => {
      void customElements.whenDefined('vertex-editor-lite').then(() => {
        resolve();
      });
    });
    script.addEventListener('error', () => {
      editorReady = undefined;
      reject(new Error('The code editor failed to load.'));
    });
    document.head.append(script);
  });

  return editorReady;
}

/**
 * A code sample with a copy button.
 *
 * Server-rendered pages and readers without scripts get a plain `<pre>`; in the browser it
 * becomes Vertex's `vertex-editor-lite`, with syntax highlighting. Both occupy the same height,
 * so the swap does not move the page.
 */
@Component({
  selector: 'app-code-block',
  imports: [CopyButton],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="code-frame" [style.height.px]="height() + framePadding">
      <app-copy-button [text]="code()" [label]="copyLabel()" [copiedLabel]="copiedLabel()" />
      @if (enhanced()) {
        <vertex-editor-lite
          theme="dark"
          line-numbers="false"
          [attr.value]="code()"
          [attr.language]="language()"
          [attr.aria-label]="label()"
          [attr.height]="height() + 'px'"
          (ready)="show($event)"
        />
      } @else {
        <pre [attr.aria-label]="label()"><code>{{ code() }}</code></pre>
      }
    </div>
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly language = input<'typescript' | 'javascript' | 'html' | 'css' | 'json'>('typescript');
  readonly label = input('Code');
  readonly copyLabel = input('Copy');
  readonly copiedLabel = input('Copied');

  protected readonly framePadding = FRAME_PADDING;
  protected readonly enhanced = signal(false);
  protected readonly height = computed(() =>
    Math.ceil(this.code().split('\n').length * LINE_HEIGHT + EDITOR_PADDING),
  );

  /**
   * The element reads `value` once while it starts, which can be before Angular has set the
   * attribute, so the code is handed over again when it reports that it is ready.
   */
  protected show(event: Event): void {
    (event.target as HTMLElement & { setValue(value: string): void }).setValue(this.code());
  }

  constructor() {
    afterNextRender(() => {
      loadEditor().then(
        () => {
          this.enhanced.set(true);
        },
        () => {
          // The plain <pre> is already a complete answer.
        },
      );
    });
  }
}
