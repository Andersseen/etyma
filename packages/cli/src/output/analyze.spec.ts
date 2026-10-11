import type { MessageUsageAnalysis, SourceDiagnostic } from '@etyma/tooling/source';
import { describe, expect, it } from 'vitest';

import { formatAnalyzePretty } from './analyze.js';

function render(diagnostic: Partial<SourceDiagnostic>): string {
  const analysis: MessageUsageAnalysis = {
    used: [],
    unreferenced: [],
    diagnostics: [
      {
        code: 'source.unknown-key',
        severity: 'error',
        path: 'a.ts',
        line: 1,
        column: 1,
        key: 'k',
        message: 'm',
        ...diagnostic,
      },
    ],
  };
  return formatAnalyzePretty(analysis, { fileCount: 1 });
}

describe('formatAnalyzePretty suggestions', () => {
  it('prints one suggestion on one line', () => {
    expect(render({ suggestions: ['nav.docs'] })).toContain('  m\n  Did you mean "nav.docs"?\n\n');
  });

  it('prints several suggestions as a list', () => {
    expect(render({ suggestions: ['nav.docs', 'nav.dock'] })).toContain(
      '  Did you mean one of:\n    nav.docs\n    nav.dock\n\n',
    );
  });

  it('prints nothing extra without a suggestion', () => {
    expect(render({})).not.toContain('Did you mean');
    expect(render({ suggestions: [] })).not.toContain('Did you mean');
  });
});
