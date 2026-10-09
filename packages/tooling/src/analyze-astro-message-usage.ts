import ts from 'typescript';

import { collectMessageUsage, finalizeMessageUsage } from './analyze-message-usage.js';
import type { MessageUsageReference } from './analyze-message-usage.js';
import { scanSource } from './source-scan.js';
import { createProjectProvenance } from './source-provenance.js';
import type { SourcePositionMapper } from './source-scan.js';
import type {
  AnalyzeMessageUsageOptions,
  MessageUsageAnalysis,
  SourceDiagnostic,
  SourceFile,
} from './source-types.js';

/** Input to {@link analyzeAstroMessageUsage}. All files are already-loaded source strings. */
export type AnalyzeAstroMessageUsageOptions = AnalyzeMessageUsageOptions;

interface Point {
  readonly line: number;
  readonly column: number;
}

interface ParsedNode {
  readonly type: string;
  readonly value?: string;
  readonly position?: { readonly start: Point; readonly end?: Point };
  readonly children?: readonly ParsedNode[];
  readonly attributes?: readonly {
    readonly kind: string;
    readonly name: string;
    readonly value: string;
    readonly position?: { readonly start: Point };
  }[];
}

interface AstroParserDiagnostic {
  readonly severity: string | number;
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

interface AstroParseIssue {
  readonly severity: string | number;
  readonly text: string;
  readonly location?: { readonly line: number; readonly column: number };
  readonly labels?: readonly { readonly line?: number; readonly column?: number }[];
}

interface LocationSegment {
  readonly virtualStart: number;
  readonly virtualEnd: number;
  readonly sourceStart: number;
}

interface ExpressionSource {
  readonly source: string;
  readonly sourceStart: number;
}

/**
 * Analyzes JS/TS and Astro files together. Astro's frontmatter and parsed expression ranges
 * are fed through the same TypeScript provenance scanner as ordinary source, so aliases,
 * namespace imports, callable aliases and lexical shadowing retain one set of semantics.
 */
export async function analyzeAstroMessageUsage(
  options: AnalyzeAstroMessageUsageOptions,
): Promise<MessageUsageAnalysis> {
  const ordinaryFiles = options.files.filter(file => !file.path.toLowerCase().endsWith('.astro'));
  const project = createProjectProvenance(options.files);
  const base = collectMessageUsage(ordinaryFiles, undefined, project);
  const references: MessageUsageReference[] = [...base.references];
  const diagnostics: SourceDiagnostic[] = [...base.diagnostics];

  for (const file of options.files) {
    if (!file.path.toLowerCase().endsWith('.astro')) continue;
    await analyzeAstroFile(file, references, diagnostics, project);
  }

  return finalizeMessageUsage(options.keys, references, diagnostics);
}

async function analyzeAstroFile(
  file: SourceFile,
  references: MessageUsageReference[],
  diagnostics: SourceDiagnostic[],
  project: ReturnType<typeof createProjectProvenance>,
): Promise<void> {
  let parsed: {
    readonly snippets: readonly ExpressionSource[];
    readonly diagnostics: readonly AstroParserDiagnostic[];
  };
  try {
    parsed = await parseAstroSource(file.source);
  } catch (error) {
    if (isMissingParser(error)) throw error;
    diagnostics.push({
      code: 'source.parse-error',
      severity: 'error',
      path: file.path,
      line: 1,
      column: 1,
      message: error instanceof Error ? error.message : 'Astro parser failed to parse this file.',
    });
    return;
  }

  for (const diagnostic of parsed.diagnostics) {
    diagnostics.push({
      code: 'source.parse-error',
      severity: diagnostic.severity === 1 || diagnostic.severity === 'error' ? 'error' : 'warning',
      path: file.path,
      line: Math.max(1, diagnostic.line),
      column: Math.max(1, diagnostic.column),
      message: diagnostic.message,
    });
  }

  const combined = composeSource(parsed.snippets);
  const parsedScript = ts.createSourceFile(
    `${file.path}.tsx`,
    combined.source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const original = ts.createSourceFile(
    file.path,
    file.source,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TSX,
  );
  const mapPosition: SourcePositionMapper = offset => {
    const segment = combined.segments.find(
      item => offset >= item.virtualStart && offset < item.virtualEnd,
    );
    const originalOffset =
      segment === undefined ? 0 : segment.sourceStart + (offset - segment.virtualStart);
    const safeOffset = Math.max(0, Math.min(file.source.length, originalOffset));
    const { line, character } = original.getLineAndCharacterOfPosition(safeOffset);
    return { line: line + 1, column: character + 1 };
  };

  const scan = scanSource(file.path, combined.source, parsedScript, mapPosition, project);
  references.push(...scan.references.map(reference => ({ path: file.path, ...reference })));
  for (const problem of scan.parseProblems) {
    diagnostics.push({
      code: 'source.parse-error',
      severity: 'error',
      path: file.path,
      line: problem.line,
      column: problem.column,
      message: problem.message,
    });
  }
}

async function parseAstroSource(source: string): Promise<{
  readonly snippets: readonly ExpressionSource[];
  readonly diagnostics: readonly AstroParserDiagnostic[];
}> {
  try {
    // Astro 6's official public compiler API is asynchronous and returns its template AST.
    const compiler = await import('@astrojs/compiler');
    const parsed = await compiler.parse(source);
    const root = parsed.ast as unknown as ParsedNode;
    const frontmatter = root.children?.find(node => node.type === 'frontmatter');
    const snippets: ExpressionSource[] = [];

    if (frontmatter?.value !== undefined && frontmatter.value.length > 0) {
      // The parser has identified the frontmatter body. This lookup maps its returned text
      // to the original file; it does not identify or parse Astro delimiters.
      const sourceStart = Math.max(0, source.indexOf(frontmatter.value));
      snippets.push({ source: frontmatter.value, sourceStart });
    }
    collectTemplateExpressions(root.children ?? [], source, snippets);

    return {
      snippets,
      diagnostics: normalizeDiagnostics(parsed.diagnostics),
    };
  } catch (legacyError) {
    if (!isMissingParser(legacyError)) throw legacyError;
  }

  // Astro 7 replaced the wasm compiler package with its official Rust/NAPI compiler. Its
  // public parser returns ESTree nodes with source ranges; the shared TSX scanner still owns
  // all Etyma binding and key semantics.
  const compiler = await import('@astrojs/compiler-rs');
  const parsed = compiler.parse(source);
  const root = parsed.ast as unknown as {
    readonly frontmatter?: {
      readonly program?: { readonly start?: number; readonly end?: number };
    };
    readonly body?: readonly {
      readonly type?: string;
      readonly start?: number;
      readonly end?: number;
      readonly expression?: { readonly start?: number; readonly end?: number };
    }[];
  };
  const snippets: ExpressionSource[] = [];
  const program = root.frontmatter?.program;
  if (program?.start !== undefined && program.end !== undefined && program.end > program.start) {
    snippets.push({
      source: source.slice(program.start, program.end),
      sourceStart: program.start,
    });
  }
  for (const node of root.body ?? []) {
    const range = node.type === 'JSXExpressionContainer' ? node.expression : node;
    if (range?.start === undefined || range.end === undefined || range.end <= range.start) continue;
    snippets.push({ source: source.slice(range.start, range.end), sourceStart: range.start });
  }

  return {
    snippets,
    diagnostics: normalizeDiagnostics(parsed.diagnostics),
  };
}

function normalizeDiagnostics(diagnostics: readonly AstroParseIssue[]): AstroParserDiagnostic[] {
  return diagnostics.map(diagnostic => {
    const location = diagnostic.location ?? diagnostic.labels?.[0];
    return {
      severity: diagnostic.severity,
      line: location?.line ?? 1,
      column: location?.column ?? 1,
      message: diagnostic.text,
    };
  });
}

function isMissingParser(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED')
  );
}

function collectTemplateExpressions(
  nodes: readonly ParsedNode[],
  source: string,
  output: ExpressionSource[],
): void {
  for (const node of nodes) {
    if (node.type === 'frontmatter') continue;

    if (node.attributes !== undefined) {
      for (const attribute of node.attributes) {
        if (attribute.kind !== 'expression' || attribute.value.length === 0) continue;
        const start = attribute.position?.start;
        if (start === undefined) continue;
        const attributeStart = offsetAtPoint(source, start);
        const found = source.indexOf(attribute.value, attributeStart + attribute.name.length);
        if (found >= 0) output.push({ source: attribute.value, sourceStart: found });
      }
    }

    if (node.type === 'expression') {
      const first = firstTextNode(node);
      const last = lastTextNode(node);
      if (first?.value !== undefined && last?.value !== undefined) {
        const firstHint =
          first.position === undefined ? 0 : offsetAtPoint(source, first.position.start);
        const start = source.indexOf(first.value, firstHint);
        const lastHint =
          last.position === undefined ? start : offsetAtPoint(source, last.position.start);
        const lastStart = source.indexOf(last.value, Math.max(start, lastHint));
        const end = lastStart < 0 ? -1 : lastStart + last.value.length;
        if (start >= 0 && end >= start) {
          output.push({ source: source.slice(start, end), sourceStart: start });
        }
      }
      // A complete Astro expression includes nested JSX-like markup. TypeScript's TSX parser
      // handles those nested expressions, so walking the compiler children would duplicate it.
      continue;
    }

    collectTemplateExpressions(node.children ?? [], source, output);
  }
}

function firstTextNode(node: ParsedNode): ParsedNode | undefined {
  if (node.type === 'text') return node;
  for (const child of node.children ?? []) {
    const found = firstTextNode(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function lastTextNode(node: ParsedNode): ParsedNode | undefined {
  if (node.type === 'text') return node;
  const children = node.children ?? [];
  for (let index = children.length - 1; index >= 0; index -= 1) {
    const child = children[index];
    if (child === undefined) continue;
    const found = lastTextNode(child);
    if (found !== undefined) return found;
  }
  return undefined;
}

function composeSource(snippets: readonly ExpressionSource[]): {
  readonly source: string;
  readonly segments: readonly LocationSegment[];
} {
  let source = '';
  const segments: LocationSegment[] = [];

  for (const [index, snippet] of snippets.entries()) {
    if (index === 0) {
      const virtualStart = source.length;
      source += snippet.source;
      segments.push({
        virtualStart,
        virtualEnd: source.length,
        sourceStart: snippet.sourceStart,
      });
      continue;
    }

    source += '\nvoid (\n';
    const virtualStart = source.length;
    source += snippet.source;
    segments.push({
      virtualStart,
      virtualEnd: source.length,
      sourceStart: snippet.sourceStart,
    });
    source += '\n);\n';
  }

  return { source, segments };
}

function offsetAtPoint(source: string, point: Point): number {
  let offset = 0;
  for (let line = 1; line < point.line; line += 1) {
    const newline = source.indexOf('\n', offset);
    if (newline < 0) return source.length;
    offset = newline + 1;
  }
  return Math.min(source.length, offset + Math.max(0, point.column - 1));
}
