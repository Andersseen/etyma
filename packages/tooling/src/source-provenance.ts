import ts from 'typescript';

import type { SourceFile } from './source-types.js';

export type ProvenanceKind = 'callable' | 'i18n' | 'translator';
export interface ProvenanceSummary {
  readonly kind: ProvenanceKind;
  readonly role: 'value' | 'factory';
}

export interface ProjectProvenance {
  readonly modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>;
  readonly locals: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>;
  resolve(from: string, specifier: string): string | undefined;
}

export function importedProvenance(
  project: ProjectProvenance,
  from: string,
  specifier: string,
  imported: string,
): ProvenanceSummary | undefined {
  const canonical = CANONICAL_FACTORIES.get(specifier)?.get(imported);
  if (canonical) return { kind: canonical, role: 'factory' };
  const target = project.resolve(from, specifier);
  return target ? project.modules.get(target)?.get(imported) : undefined;
}

export const CANONICAL_FACTORIES: ReadonlyMap<
  string,
  ReadonlyMap<string, ProvenanceKind>
> = new Map<string, ReadonlyMap<string, ProvenanceKind>>([
  [
    '@etyma/angular',
    new Map<string, ProvenanceKind>([
      ['injectT', 'callable'],
      ['injectI18n', 'i18n'],
    ]),
  ],
  ['@etyma/astro', new Map<string, ProvenanceKind>([['createAstroI18n', 'i18n']])],
  ['@etyma/core', new Map<string, ProvenanceKind>([['createTranslator', 'translator']])],
]);

const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** Build deterministic, syntax-only summaries over the caller-supplied source universe. */
export function createProjectProvenance(files: readonly SourceFile[]): ProjectProvenance {
  const normalized = new Map<string, SourceFile[]>();
  for (const file of files) {
    if (!isScriptPath(file.path)) continue;
    const path = normalize(file.path);
    const group = normalized.get(path) ?? [];
    group.push(file);
    normalized.set(path, group);
  }
  const unique = new Map<string, SourceFile>();
  for (const [path, group] of normalized) {
    const [file] = group;
    if (group.length === 1 && file) unique.set(path, file);
  }

  const resolve = (from: string, specifier: string): string | undefined => {
    if (!specifier.startsWith('.')) return undefined;
    const base = normalize(`${dirname(normalize(from))}/${specifier}`);
    const candidates = new Set<string>();
    const add = (path: string) => {
      if (unique.has(path)) candidates.add(path);
    };
    const ext = extension(base);
    if (ext) {
      add(base);
      const mappings: Record<string, readonly string[]> = {
        '.js': ['.ts', '.tsx'],
        '.mjs': ['.mts'],
        '.cjs': ['.cts'],
      };
      for (const mapped of mappings[ext] ?? []) add(base.slice(0, -ext.length) + mapped);
    } else {
      for (const item of extensions) add(base + item);
      for (const item of extensions) add(`${base}/index${item}`);
    }
    return candidates.size === 1 ? [...candidates][0] : undefined;
  };

  const filesByPath = unique;
  const locals = new Map<string, Map<string, ProvenanceSummary>>();
  const modules = new Map<string, Map<string, ProvenanceSummary>>();
  const parsed = new Map<string, ts.SourceFile>();
  for (const [path, file] of filesByPath)
    parsed.set(path, ts.createSourceFile(path, file.source, ts.ScriptTarget.Latest, true));

  // Re-evaluate trivial expressions until no new summaries appear. Cycles stay unknown.
  for (let pass = 0; pass <= filesByPath.size; pass += 1) {
    let changed = false;
    for (const [path, source] of parsed) {
      const local = locals.get(path) ?? new Map<string, ProvenanceSummary>();
      const exported = modules.get(path) ?? new Map<string, ProvenanceSummary>();
      const imports = importBindings(source, path, resolve, modules);
      const declarations = topDeclarations(source);
      for (const [name, node] of declarations) {
        const summary = summarizeDeclaration(node, source, imports, local, modules, path, resolve);
        if (summary && !same(local.get(name), summary)) {
          local.set(name, summary);
          changed = true;
        }
      }
      for (const statement of source.statements) {
        if (ts.isExportAssignment(statement)) {
          const summary =
            ts.isArrowFunction(statement.expression) ||
            ts.isFunctionExpression(statement.expression)
              ? summarizeFunction(
                  statement.expression,
                  source,
                  imports,
                  local,
                  modules,
                  path,
                  resolve,
                )
              : summarizeExpression(statement.expression, imports, local, modules, path, resolve);
          if (summary && !same(exported.get('default'), summary)) {
            exported.set('default', summary);
            changed = true;
          }
          continue;
        }
        if (ts.isExportDeclaration(statement)) continue;
        const isExported = hasExportModifier(statement) || hasDefaultModifier(statement);
        if (!isExported) continue;
        const names = ts.isVariableStatement(statement)
          ? statement.declarationList.declarations.flatMap(item =>
              ts.isIdentifier(item.name) ? [item.name.text] : [],
            )
          : (() => {
              const item = declarationNameAndNode(statement);
              return item ? [item.name] : [];
            })();
        for (const name of names) {
          const summary = local.get(name);
          if (summary && !same(exported.get(name), summary)) {
            exported.set(name, summary);
            changed = true;
          }
        }
        if (hasDefaultModifier(statement)) {
          const item = declarationNameAndNode(statement);
          const summary = item ? local.get(item.name) : undefined;
          if (summary && !same(exported.get('default'), summary)) {
            exported.set('default', summary);
            changed = true;
          }
        }
      }
      locals.set(path, local);
      modules.set(path, exported);
    }
    if (!changed) break;
  }
  return { modules, locals, resolve };
}

function importBindings(
  source: ts.SourceFile,
  path: string,
  resolve: ProjectProvenance['resolve'],
  modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>,
) {
  const result = new Map<string, ProvenanceSummary>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const clause = statement.importClause;
    if (!clause || clause.phaseModifier) continue;
    const specifier = statement.moduleSpecifier.text;
    const canonical = CANONICAL_FACTORIES.get(specifier);
    const target = resolve(path, specifier);
    const exports = target ? modules.get(target) : undefined;
    if (clause.name) {
      const value = exports?.get('default');
      if (value) result.set(clause.name.text, value);
    }
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings))
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) {
          const imported = (element.propertyName ?? element.name).text;
          const canonicalKind = canonical?.get(imported);
          const value = canonicalKind
            ? { kind: canonicalKind, role: 'factory' as const }
            : exports?.get(imported);
          if (value) result.set(element.name.text, value);
        }
      }
    // Namespace property access is handled by the scanner using the `namespaces` map.
  }
  return result;
}

function topDeclarations(source: ts.SourceFile): Map<string, ts.Node> {
  const result = new Map<string, ts.Node>();
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
    ) {
      for (const declaration of statement.declarationList.declarations)
        if (ts.isIdentifier(declaration.name)) result.set(declaration.name.text, declaration);
      continue;
    }
    const item = declarationNameAndNode(statement);
    if (item) result.set(item.name, item.node);
  }
  return result;
}

function declarationNameAndNode(
  statement: ts.Statement,
): { name: string; node: ts.Node } | undefined {
  if (ts.isVariableStatement(statement)) {
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) return undefined;
    const declaration = statement.declarationList.declarations[0];
    return declaration && ts.isIdentifier(declaration.name)
      ? { name: declaration.name.text, node: declaration }
      : undefined;
  }
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name)
    return { name: statement.name.text, node: statement };
  return undefined;
}

function summarizeDeclaration(
  node: ts.Node,
  source: ts.SourceFile,
  imports: Map<string, ProvenanceSummary>,
  locals: Map<string, ProvenanceSummary>,
  modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>,
  path: string,
  resolve: ProjectProvenance['resolve'],
): ProvenanceSummary | undefined {
  if (ts.isFunctionDeclaration(node))
    return summarizeFunction(node, source, imports, locals, modules, path, resolve);
  if (!ts.isVariableDeclaration(node) || !node.initializer) return undefined;
  if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    return summarizeFunction(node.initializer, source, imports, locals, modules, path, resolve);
  return summarizeExpression(node.initializer, imports, locals, modules, path, resolve);
}

function summarizeFunction(
  node: ts.FunctionLikeDeclaration,
  source: ts.SourceFile,
  imports: Map<string, ProvenanceSummary>,
  locals: Map<string, ProvenanceSummary>,
  modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>,
  path: string,
  resolve: ProjectProvenance['resolve'],
): ProvenanceSummary | undefined {
  let expression: ts.Expression | undefined;
  const onlyStatement = node.body && ts.isBlock(node.body) ? node.body.statements[0] : undefined;
  if (
    node.body &&
    ts.isBlock(node.body) &&
    node.body.statements.length === 1 &&
    onlyStatement &&
    ts.isReturnStatement(onlyStatement)
  )
    expression = onlyStatement.expression;
  else if (node.body && !ts.isBlock(node.body)) expression = node.body;
  if (!expression) return undefined;
  const params = new Map(imports);
  const shadowedLocals = new Map(locals);
  node.parameters.forEach(p => {
    if (ts.isIdentifier(p.name)) {
      params.delete(p.name.text);
      shadowedLocals.delete(p.name.text);
    }
  });
  const summary = summarizeExpression(expression, params, shadowedLocals, modules, path, resolve);
  return summary?.role === 'value' ? { ...summary, role: 'factory' } : undefined;
}

function summarizeExpression(
  expression: ts.Expression,
  imports: Map<string, ProvenanceSummary>,
  locals: Map<string, ProvenanceSummary>,
  modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>,
  path: string,
  resolve: ProjectProvenance['resolve'],
): ProvenanceSummary | undefined {
  const node = unwrap(expression);
  if (ts.isIdentifier(node)) return locals.get(node.text) ?? imports.get(node.text);
  if (ts.isCallExpression(node)) {
    const callee = unwrap(node.expression);
    let binding: ProvenanceSummary | undefined;
    if (ts.isIdentifier(callee)) binding = locals.get(callee.text) ?? imports.get(callee.text);
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      const module = namespaceImport(
        node.getSourceFile(),
        path,
        callee.expression.text,
        resolve,
        modules,
      );
      binding = module?.get(callee.name.text);
    }
    if (binding?.role === 'factory') return { kind: binding.kind, role: 'value' };
  }
  if (
    ts.isPropertyAccessExpression(node) &&
    (node.name.text === 't' ||
      node.name.text === 'parts' ||
      node.name.text === 'translate' ||
      node.name.text === 'translateToParts')
  ) {
    const receiver = summarizeExpression(node.expression, imports, locals, modules, path, resolve);
    if (receiver?.role === 'value') return { kind: 'callable', role: 'value' };
  }
  return undefined;
}

function namespaceImport(
  source: ts.SourceFile,
  path: string,
  name: string,
  resolve: ProjectProvenance['resolve'],
  modules: ReadonlyMap<string, ReadonlyMap<string, ProvenanceSummary>>,
) {
  for (const statement of source.statements)
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      if (
        clause &&
        !clause.phaseModifier &&
        clause.namedBindings &&
        ts.isNamespaceImport(clause.namedBindings) &&
        clause.namedBindings.name.text === name
      ) {
        const specifier = statement.moduleSpecifier.text;
        const canonical = CANONICAL_FACTORIES.get(specifier);
        if (canonical)
          return new Map(
            [...canonical].map(([factory, kind]) => [factory, { kind, role: 'factory' as const }]),
          );
        const target = resolve(path, specifier);
        return target ? modules.get(target) : undefined;
      }
    }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) ?? false)
  );
}
function hasDefaultModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false)
  );
}
function same(a: ProvenanceSummary | undefined, b: ProvenanceSummary): boolean {
  return a?.kind === b.kind && a.role === b.role;
}
function unwrap(e: ts.Expression): ts.Expression {
  let n = e;
  while (
    ts.isParenthesizedExpression(n) ||
    ts.isAsExpression(n) ||
    ts.isSatisfiesExpression(n) ||
    ts.isTypeAssertionExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isAwaitExpression(n)
  )
    n = n.expression;
  return n;
}
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return (path.startsWith('/') ? '/' : '') + parts.join('/');
}
function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index < 0 ? '.' : path.slice(0, index);
}
function extension(path: string): string | undefined {
  return /\.[^./]+$/.exec(path)?.[0];
}

function isScriptPath(path: string): boolean {
  return /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(path) && !/\.d\.(?:ts|mts|cts)$/i.test(path);
}
