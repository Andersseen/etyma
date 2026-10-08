import { describe, expect, it } from 'vitest';

import { analyzeAngularMessageUsage } from './angular.js';

const KEYS = ['nav.home', 'nav.docs', 'actions.save', 'rich.message', 'feature.title', 'row.title'];
const IMPORTS = `import { Component } from '@angular/core';
import { injectI18n, injectT } from '@etyma/angular';`;

function analyze(files: { path: string; source: string }[]) {
  return analyzeAngularMessageUsage({ keys: KEYS, files });
}

describe('analyzeAngularMessageUsage', () => {
  it('combines ordinary JS/TS references with an inline template before finding unreferenced keys', () => {
    const result = analyze([
      {
        path: 'src/nav.ts',
        source: `${IMPORTS}
@Component({ template: \`{{ t('nav.home') }}\` })
export class Nav { readonly t = injectT(definition); }
const i18n = injectI18n(definition);
i18n.t('nav.docs');`,
      },
    ]);

    expect(result.used).toEqual(['nav.docs', 'nav.home']);
    expect(result.unreferenced).toEqual([
      'actions.save',
      'feature.title',
      'rich.message',
      'row.title',
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('resolves an external template in memory and reports its actual path and location', () => {
    const result = analyze([
      {
        path: 'src/app/nav.ts',
        source: `import { Component } from '@angular/core';
import { injectT } from '@etyma/angular';
@Component({ templateUrl: '../templates/nav.html' })
export class Nav { readonly t = injectT(definition); }`,
      },
      {
        path: 'src/templates/nav.html',
        source: `
  <h1>{{ t('nav.home') }}</h1>
  <p>{{ t('nav.typo') }}</p>`,
      },
      { path: 'src/unrelated.html', source: `{{ t('not.etyma') }}` },
    ]);

    expect(result.used).toEqual(['nav.home']);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'source.unknown-key',
        severity: 'error',
        path: 'src/templates/nav.html',
        line: 3,
        column: 11,
        key: 'nav.typo',
      }),
    ]);
  });

  it('recognizes aliased imports, injectI18n members, and a this.i18n.t callable field', () => {
    const result = analyze([
      {
        path: 'src/nav.ts',
        source: `import { Component as NgComponent } from '@angular/core';
import { injectI18n as useI18n } from '@etyma/angular';
@NgComponent({ template: \`{{ i18n.t('nav.home') }} {{ i18n.parts('rich.message') }} {{ t('nav.docs') }}\` })
export class Nav {
  readonly i18n = useI18n(definition);
  readonly t = this.i18n.t;
}`,
      },
    ]);
    expect(result.used).toEqual(['nav.docs', 'nav.home', 'rich.message']);
    expect(result.diagnostics).toEqual([]);
  });

  it('recognizes namespace imports and aliased injectT fields by their import bindings', () => {
    const result = analyze([
      {
        path: 'src/nav.ts',
        source: `import * as ng from '@angular/core';
import { injectT as useT } from '@etyma/angular';
@ng.Component({ template: \`{{ translate('nav.home') }}\` })
export class Nav { readonly translate = useT(definition); }`,
      },
    ]);
    expect(result.used).toEqual(['nav.home']);
  });

  it('does not attribute unrelated template functions or project wrappers to Etyma', () => {
    const result = analyze([
      {
        path: 'src/nav.ts',
        source: `${IMPORTS}
function injectAppI18n() { return injectI18n(definition); }
@Component({ template: \`{{ t('nav.typo') }} {{ i18n.t('nav.typo') }}\` })
export class Nav {
  readonly i18n = injectAppI18n();
  readonly t = (value: string) => value;
}`,
      },
    ]);
    expect(result.used).toEqual([]);
    expect(result.unreferenced).toEqual([...KEYS].sort());
    expect(result.diagnostics).toEqual([]);
  });

  it('emits dynamic-key warnings and unknown-key errors at the template argument', () => {
    const result = analyze([
      {
        path: 'src/nav.ts',
        source: `${IMPORTS}
@Component({ template: \`{{ t(key) }} {{ t(prefix + '.title') }} {{ t('nav.typo') }}\` })
export class Nav { readonly t = injectT(definition); }`,
      },
    ]);
    expect(result.diagnostics.map(({ code, severity, key }) => ({ code, severity, key }))).toEqual([
      { code: 'source.dynamic-key', severity: 'warning', key: undefined },
      { code: 'source.dynamic-key', severity: 'warning', key: undefined },
      { code: 'source.unknown-key', severity: 'error', key: 'nav.typo' },
    ]);
    expect(result.used).toEqual([]);
  });

  it('maps single-line, multiline, and indented inline template diagnostics to the component source', () => {
    const single = analyze([
      {
        path: 'src/one.ts',
        source: `${IMPORTS}\n@Component({ template: \`{{ t('nav.typo') }}\` })\nexport class One { readonly t = injectT(definition); }`,
      },
    ]).diagnostics[0];
    expect(single).toMatchObject({ path: 'src/one.ts', line: 3, column: 30, key: 'nav.typo' });

    const multi = analyze([
      {
        path: 'src/multi.ts',
        source: `${IMPORTS}
@Component({
  template: \`
    <h1>{{ t('nav.typo') }}</h1>
  \`,
})
export class Multi { readonly t = injectT(definition); }`,
      },
    ]).diagnostics[0];
    expect(multi).toMatchObject({ path: 'src/multi.ts', line: 5, column: 14, key: 'nav.typo' });
  });

  it('handles property bindings, events, and modern control-flow expressions', () => {
    const result = analyze([
      {
        path: 'src/view.ts',
        source: `${IMPORTS}
@Component({ template: \`
  <button [attr.aria-label]="t('actions.save')" (click)="t('nav.home')"></button>
  @if (t('feature.title')) { @let title = t('nav.docs'); {{ title }} }
  @for (row of rows; track t('row.title')) { {{ t('nav.home') }} }
  @switch (t('feature.title')) { @case (t('nav.docs')) { {{ t('actions.save') }} } }
\` })
export class View { readonly t = injectT(definition); }`,
      },
    ]);
    expect(result.used).toEqual([
      'actions.save',
      'feature.title',
      'nav.docs',
      'nav.home',
      'row.title',
    ]);
    expect(result.diagnostics).toEqual([]);
  });

  it('reports template parse errors, missing external templates, and continues with other components', () => {
    const result = analyze([
      {
        path: 'src/a.ts',
        source: `${IMPORTS}
@Component({ template: \`<div>{{ t('nav.home') }}</div> @if (\` })
export class Broken { readonly t = injectT(definition); }
@Component({ templateUrl: './missing.html' })
export class Missing { readonly t = injectT(definition); }`,
      },
      {
        path: 'src/b.ts',
        source: `${IMPORTS}
@Component({ template: \`{{ t('nav.docs') }}\` })
export class Good { readonly t = injectT(definition); }`,
      },
    ]);
    expect(result.used).toEqual(['nav.docs']);
    expect(result.diagnostics.map(diagnostic => diagnostic.code)).toContain('source.parse-error');
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'source.template-missing',
        path: 'src/a.ts',
        line: 5,
        column: 27,
        templatePath: 'src/missing.html',
        severity: 'error',
      }),
    );
  });

  it('reports malformed component metadata that declares both template sources', () => {
    const result = analyze([
      {
        path: 'src/both.ts',
        source: `${IMPORTS}\n@Component({ template: \`{{ t('nav.home') }}\`, templateUrl: './view.html' })\nclass Both { readonly t = injectT(definition); }`,
      },
      { path: 'src/view.html', source: `{{ t('nav.docs') }}` },
    ]);
    expect(result.used).toEqual([]);
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'source.parse-error',
        path: 'src/both.ts',
        message: 'Angular component metadata cannot define both template and templateUrl.',
      }),
    );
  });

  it('uses the final field initializer and ignores components with non-Angular decorators', () => {
    const result = analyze([
      {
        path: 'src/app.ts',
        source: `import { Component } from './not-angular.js';
import { injectT } from '@etyma/angular';
@Component({ template: \`{{ t('nav.typo') }}\` })
class NotAngular { readonly t = injectT(definition); }`,
      },
      {
        path: 'src/other.ts',
        source: `${IMPORTS}
@Component({ template: \`{{ t('nav.typo') }}\` })
class Shadowed { readonly t = injectT(definition); readonly t = somethingElse; }`,
      },
    ]);
    expect(result.diagnostics).toEqual([]);
    expect(result.used).toEqual([]);
  });

  it('does not attribute template-local names that shadow proven component fields', () => {
    const result = analyze([
      {
        path: 'src/local.ts',
        source: `${IMPORTS}
@Component({ template: \`@let t = unrelated; {{ t('nav.typo') }}\` })
class Local { readonly t = injectT(definition); }`,
      },
    ]);
    expect(result.used).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });

  it('is deterministic when component and template input order changes', () => {
    const files = [
      {
        path: 'src/z.ts',
        source: `${IMPORTS}\n@Component({ template: \`{{ t('nav.docs') }}\` })\nclass Z { readonly t = injectT(x); }`,
      },
      {
        path: 'src/a.ts',
        source: `${IMPORTS}\n@Component({ template: \`{{ t('nav.home') }}\` })\nclass A { readonly t = injectT(x); }`,
      },
    ];
    expect(analyze(files)).toEqual(analyze([...files].reverse()));
  });

  it('keeps correctness across hundreds of mixed components and thousands of template calls', () => {
    const keys = Array.from({ length: 500 }, (_, index) => `key.${index}`).sort();
    const files = [] as { path: string; source: string }[];
    const declarations = [
      `import { Component } from '@angular/core';`,
      `import { injectT } from '@etyma/angular';`,
    ];
    for (let component = 0; component < 240; component += 1) {
      const calls = Array.from({ length: 8 }, (_, call) => {
        const key = `key.${(component * 8 + call) % keys.length}`;
        return `{{ t('${key}') }}`;
      }).join(' ');
      if (component % 2 === 0) {
        declarations.push(
          `@Component({ template: \`${calls}\` }) class Inline${component} { readonly t = injectT(def); }`,
        );
      } else {
        const name = `component-${component}.html`;
        declarations.push(
          `@Component({ templateUrl: './${name}' }) class External${component} { readonly t = injectT(def); }`,
        );
        files.push({ path: `src/${name}`, source: calls });
      }
    }
    files.unshift({ path: 'src/components.ts', source: declarations.join('\n') });

    const result = analyzeAngularMessageUsage({ keys, files });
    expect(result.used).toEqual(keys);
    expect(result.unreferenced).toEqual([]);
    expect(result.diagnostics).toEqual([]);
  });
});
