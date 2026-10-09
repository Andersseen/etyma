// eslint-disable-next-line no-restricted-imports -- Isolated behind the opt-in @etyma/tooling/angular subpath.
import {
  ASTWithSource,
  ImplicitReceiver,
  LiteralPrimitive,
  parseTemplate,
  PropertyRead,
  RecursiveAstVisitor,
  TmplAstRecursiveVisitor,
  SafePropertyRead,
  ThisReceiver,
  tmplAstVisitAll,
  type AST,
  type Call,
  type SafeCall,
  type TmplAstBoundAttribute,
  type TmplAstBoundEvent,
  type TmplAstBoundText,
  type TmplAstForLoopBlock,
  type TmplAstIfBlockBranch,
  type TmplAstLetDeclaration,
  type TmplAstReference,
  type TmplAstSwitchBlock,
  type TmplAstSwitchBlockCase,
  type TmplAstVariable,
} from '@angular/compiler';
import ts from 'typescript';

import { collectMessageUsage, finalizeMessageUsage } from './analyze-message-usage.js';
import type { MessageUsageReference } from './analyze-message-usage.js';
import { createProjectProvenance, importedProvenance } from './source-provenance.js';
import type { MessageUsageAnalysis, SourceDiagnostic, SourceFile } from './source-types.js';

/** Input to {@link analyzeAngularMessageUsage}. All files are already-loaded source strings. */
export interface AnalyzeAngularMessageUsageOptions {
  readonly keys: readonly string[];
  readonly files: readonly SourceFile[];
}

type MemberKind = 'callable' | 'i18n';
type ComponentTemplate =
  | { readonly kind: 'inline'; readonly text: string; readonly offset: number }
  | {
      readonly kind: 'external';
      readonly path: string;
      readonly line: number;
      readonly column: number;
    };

/**
 * Analyzes ordinary JS/TS Etyma calls and statically provable Etyma calls in templates
 * associated with Angular components. It reads no files and resolves only supplied relative
 * imports in memory; it does no filesystem or type-based module resolution.
 */
export function analyzeAngularMessageUsage(
  options: AnalyzeAngularMessageUsageOptions,
): MessageUsageAnalysis {
  const jsFiles = options.files.filter(file => isScriptFile(file.path));
  const sourceFiles = new Map(
    jsFiles.map(file => [
      file.path,
      ts.createSourceFile(
        file.path,
        file.source,
        ts.ScriptTarget.Latest,
        true,
        scriptKindOf(file.path),
      ),
    ]),
  );
  const project = createProjectProvenance(options.files);
  const base = collectMessageUsage(jsFiles, path => sourceFiles.get(path), project);
  const templates = new Map(options.files.map(file => [normalizePath(file.path), file]));
  const parsedTemplates = new Map<string, ReturnType<typeof parseTemplate>>();
  const references: MessageUsageReference[] = [];
  const diagnostics: SourceDiagnostic[] = [...base.diagnostics];

  for (const file of jsFiles) {
    const sourceFile = sourceFiles.get(file.path);
    if (sourceFile === undefined) continue;
    const bindings = importsOf(sourceFile);

    for (const statement of sourceFile.statements) {
      if (!ts.isClassDeclaration(statement)) continue;

      const componentDecorator = getDecorators(statement).find(decorator =>
        isComponentDecorator(decorator, bindings),
      );
      if (componentDecorator === undefined) continue;

      const metadata = metadataOf(componentDecorator);
      if (metadata === undefined) continue;

      if (metadata.template !== undefined && metadata.templateUrl !== undefined) {
        const location = locate(sourceFile, metadata.templateUrl);
        diagnostics.push({
          code: 'source.parse-error',
          severity: 'error',
          path: file.path,
          ...location,
          message: 'Angular component metadata cannot define both template and templateUrl.',
        });
        continue;
      }

      const template = componentTemplate(metadata, sourceFile);
      if (template === undefined) continue;

      let templatePath: string;
      let text: string;
      let inlineOffset: number | undefined;

      if (template.kind === 'inline') {
        templatePath = file.path;
        text = template.text;
        inlineOffset = template.offset;
      } else {
        templatePath = resolveMemoryPath(file.path, template.path);
        const external = templates.get(templatePath);
        if (external === undefined) {
          diagnostics.push({
            code: 'source.template-missing',
            severity: 'error',
            path: file.path,
            line: template.line,
            column: template.column,
            templatePath,
            message: `The Angular template "${templatePath}" was not supplied in files.`,
          });
          continue;
        }
        text = external.source;
      }

      const memberKinds = componentMemberKinds(statement, bindings, project, file.path);
      const templateCacheKey = `${templatePath}\u0000${text}`;
      let parsed = parsedTemplates.get(templateCacheKey);
      if (parsed === undefined) {
        parsed = parseTemplate(text, templatePath, {
          enableBlockSyntax: true,
          enableLetSyntax: true,
        });
        parsedTemplates.set(templateCacheKey, parsed);
      }

      for (const error of parsed.errors ?? []) {
        const templatePosition = error.span.start.offset;
        const location =
          inlineOffset === undefined
            ? locateText(text, templatePosition)
            : locate(sourceFile, inlineOffset + templatePosition);
        diagnostics.push({
          code: 'source.parse-error',
          severity: 'error',
          path: templatePath,
          ...location,
          message: error.msg,
        });
      }

      // Template locals shadow component fields. The visitor collects names across the whole
      // template and suppresses same-named fields globally: conservative for visibility, safe
      // for attribution without reproducing Angular's full lexical-scope resolver.
      const localNames = new Set<string>();
      tmplAstVisitAll(new TemplateLocalNameVisitor(localNames), parsed.nodes);
      const visibleMembers = new Map([...memberKinds].filter(([name]) => !localNames.has(name)));
      const visitor = new EtymaTemplateVisitor(visibleMembers, reference => {
        const location =
          inlineOffset === undefined
            ? locateText(text, reference.offset)
            : locate(sourceFile, inlineOffset + reference.offset);
        references.push({ path: templatePath, key: reference.key, ...location });
      });
      tmplAstVisitAll(visitor, parsed.nodes);
    }
  }

  // Both syntax frontends feed the same finalizer so the used and unreferenced sets and
  // diagnostic ordering reflect one combined run.
  return finalizeMessageUsage(options.keys, [...base.references, ...references], diagnostics);
}

class TemplateLocalNameVisitor extends TmplAstRecursiveVisitor {
  constructor(private readonly names: Set<string>) {
    super();
  }

  override visitLetDeclaration(node: TmplAstLetDeclaration): void {
    this.names.add(node.name);
    super.visitLetDeclaration(node);
  }

  override visitVariable(node: TmplAstVariable): void {
    this.names.add(node.name);
    super.visitVariable(node);
  }

  override visitReference(node: TmplAstReference): void {
    this.names.add(node.name);
    super.visitReference(node);
  }

  override visitForLoopBlock(node: TmplAstForLoopBlock): void {
    this.names.add(node.item.name);
    for (const variable of node.contextVariables) this.names.add(variable.name);
    super.visitForLoopBlock(node);
  }
}

interface TemplateCallReference {
  readonly key: string | undefined;
  readonly offset: number;
}

class EtymaTemplateVisitor extends TmplAstRecursiveVisitor {
  private readonly expressions = new TemplateExpressionVisitor();

  constructor(
    private readonly members: ReadonlyMap<string, MemberKind>,
    private readonly onReference: (reference: TemplateCallReference) => void,
  ) {
    super();
  }

  override visitBoundText(node: TmplAstBoundText): void {
    this.read(node.value);
    super.visitBoundText(node);
  }

  override visitBoundAttribute(node: TmplAstBoundAttribute): void {
    this.read(node.value);
    super.visitBoundAttribute(node);
  }

  override visitBoundEvent(node: TmplAstBoundEvent): void {
    this.read(node.handler);
    super.visitBoundEvent(node);
  }

  override visitIfBlockBranch(node: TmplAstIfBlockBranch): void {
    if (node.expression !== null) this.read(node.expression);
    super.visitIfBlockBranch(node);
  }

  override visitForLoopBlock(node: TmplAstForLoopBlock): void {
    this.read(node.expression);
    this.read(node.trackBy);
    super.visitForLoopBlock(node);
  }

  override visitSwitchBlock(node: TmplAstSwitchBlock): void {
    this.read(node.expression);
    super.visitSwitchBlock(node);
  }

  override visitSwitchBlockCase(node: TmplAstSwitchBlockCase): void {
    if (node.expression !== null) this.read(node.expression);
    super.visitSwitchBlockCase(node);
  }

  override visitLetDeclaration(node: TmplAstLetDeclaration): void {
    this.read(node.value);
    super.visitLetDeclaration(node);
  }

  private read(expression: AST | ASTWithSource): void {
    const ast: AST = expression instanceof ASTWithSource ? (expression.ast as AST) : expression;
    this.expressions.read(ast, this.members, this.onReference);
  }
}

class TemplateExpressionVisitor extends RecursiveAstVisitor {
  private members = new Map<string, MemberKind>();
  private onReference: (reference: TemplateCallReference) => void = () => undefined;

  read(
    expression: AST,
    members: ReadonlyMap<string, MemberKind>,
    onReference: (reference: TemplateCallReference) => void,
  ): void {
    this.members = new Map(members);
    this.onReference = onReference;
    expression.visit(this);
  }

  override visitCall(expression: Call, context: unknown): unknown {
    this.record(expression);
    return super.visitCall(expression, context);
  }

  override visitSafeCall(expression: SafeCall, context: unknown): unknown {
    this.record(expression);
    return super.visitSafeCall(expression, context);
  }

  private record(call: Call | SafeCall): void {
    const kind = this.callKind(call.receiver);
    if (kind === undefined) return;

    const argument = call.args[0];
    if (argument === undefined) return;
    const key =
      argument instanceof LiteralPrimitive && typeof argument.value === 'string'
        ? argument.value
        : undefined;
    this.onReference({ key, offset: argument.sourceSpan.start });
  }

  private callKind(receiver: AST): MemberKind | undefined {
    if (receiver instanceof PropertyRead || receiver instanceof SafePropertyRead) {
      if (isImplicit(receiver.receiver) && this.members.get(receiver.name) === 'callable') {
        return 'callable';
      }

      if (
        (receiver.receiver instanceof PropertyRead ||
          receiver.receiver instanceof SafePropertyRead) &&
        isImplicit(receiver.receiver.receiver) &&
        receiver.receiver.name === 'i18n' &&
        this.members.get('i18n') === 'i18n' &&
        (receiver.name === 't' || receiver.name === 'parts')
      ) {
        return 'callable';
      }
    }

    return undefined;
  }
}

function isImplicit(expression: AST): boolean {
  return expression instanceof ImplicitReceiver || expression instanceof ThisReceiver;
}

function componentMemberKinds(
  declaration: ts.ClassDeclaration,
  bindings: ImportBindings,
  project: ReturnType<typeof createProjectProvenance>,
  path: string,
): ReadonlyMap<string, MemberKind> {
  const initializers = new Map<string, ts.Expression>();
  for (const member of declaration.members) {
    if (!ts.isPropertyDeclaration(member) || member.initializer === undefined) continue;
    if (
      ts.canHaveModifiers(member) &&
      ts.getModifiers(member)?.some(m => m.kind === ts.SyntaxKind.StaticKeyword)
    )
      continue;
    const name = propertyName(member.name);
    if (name !== undefined) initializers.set(name, member.initializer);
  }

  const result = new Map<string, MemberKind>();
  const resolving = new Set<string>();
  const kindOfMember = (name: string): MemberKind | undefined => {
    if (result.has(name)) return result.get(name);
    if (resolving.has(name)) return undefined;
    const initializer = initializers.get(name);
    if (initializer === undefined) return undefined;
    resolving.add(name);
    const kind = kindOfInitializer(initializer, bindings, kindOfMember, project, path);
    resolving.delete(name);
    if (kind !== undefined) result.set(name, kind);
    return kind;
  };

  for (const name of initializers.keys()) kindOfMember(name);
  return result;
}

function kindOfInitializer(
  expression: ts.Expression,
  bindings: ImportBindings,
  kindOfMember: (name: string) => MemberKind | undefined,
  project: ReturnType<typeof createProjectProvenance>,
  path: string,
): MemberKind | undefined {
  const node = unwrap(expression);
  if (!ts.isCallExpression(node)) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === 't' &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.kind === ts.SyntaxKind.ThisKeyword &&
      kindOfMember(node.expression.name.text) === 'i18n'
    )
      return 'callable';
    return undefined;
  }

  const symbol = importedSymbol(node.expression, bindings);
  if (symbol) {
    const provenance = importedProvenance(project, path, symbol.module, symbol.imported);
    if (provenance?.role === 'factory' && provenance.kind !== 'translator') return provenance.kind;
  }
  return undefined;
}

interface ImportBindings {
  readonly named: ReadonlyMap<string, { readonly module: string; readonly imported: string }>;
  readonly namespaces: ReadonlyMap<string, string>;
}

function importsOf(source: ts.SourceFile): ImportBindings {
  const named = new Map<string, { module: string; imported: string }>();
  const namespaces = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue;
    const module = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    const namedBindings = clause?.namedBindings;
    if (namedBindings === undefined) continue;
    if (clause?.phaseModifier !== undefined) continue;
    if (ts.isNamespaceImport(namedBindings)) namespaces.set(namedBindings.name.text, module);
    else
      for (const element of namedBindings.elements) {
        if (!element.isTypeOnly) {
          named.set(element.name.text, {
            module,
            imported: (element.propertyName ?? element.name).text,
          });
        }
      }
  }
  return { named, namespaces };
}

function importedSymbol(
  expression: ts.Expression,
  bindings: ImportBindings,
): { readonly module: string; readonly imported: string } | undefined {
  const node = unwrap(expression);
  if (ts.isIdentifier(node)) {
    return bindings.named.get(node.text);
  }
  if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
    const module = bindings.namespaces.get(node.expression.text);
    return module === undefined ? undefined : { module, imported: node.name.text };
  }
  return undefined;
}

function isComponentDecorator(decorator: ts.Decorator, bindings: ImportBindings): boolean {
  const expression = unwrap(decorator.expression);
  if (!ts.isCallExpression(expression)) return false;
  const symbol = importedSymbol(expression.expression, bindings);
  return symbol?.module === '@angular/core' && symbol.imported === 'Component';
}

function metadataOf(
  decorator: ts.Decorator,
): { template?: ts.Expression; templateUrl?: ts.Expression } | undefined {
  const expression = unwrap(decorator.expression);
  if (!ts.isCallExpression(expression) || expression.arguments.length !== 1) return undefined;
  const argumentExpression = expression.arguments[0];
  if (argumentExpression === undefined) return undefined;
  const argument = unwrap(argumentExpression);
  if (!ts.isObjectLiteralExpression(argument)) return undefined;
  const metadata: { template?: ts.Expression; templateUrl?: ts.Expression } = {};
  for (const property of argument.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const name = propertyName(property.name);
    if (name === 'template') metadata.template = property.initializer;
    if (name === 'templateUrl') metadata.templateUrl = property.initializer;
  }
  return metadata;
}

function componentTemplate(
  metadata: { template?: ts.Expression; templateUrl?: ts.Expression },
  source: ts.SourceFile,
): ComponentTemplate | undefined {
  if (metadata.template !== undefined) {
    const value = unwrap(metadata.template);
    if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) return undefined;
    const raw = value.getText(source);
    const content = raw.slice(1, -1);
    // Escapes change cooked Angular offsets. Skip those templates rather than invent source locations.
    if (content !== value.text) return undefined;
    return { kind: 'inline', text: value.text, offset: value.getStart(source) + 1 };
  }

  if (metadata.templateUrl !== undefined) {
    const value = unwrap(metadata.templateUrl);
    if (!ts.isStringLiteral(value) && !ts.isNoSubstitutionTemplateLiteral(value)) return undefined;
    const location = locate(source, metadata.templateUrl);
    return { kind: 'external', path: value.text, ...location };
  }

  return undefined;
}

function getDecorators(node: ts.Node): readonly ts.Decorator[] {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function propertyName(name: ts.PropertyName | ts.BindingName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))
    return name.text;
  return undefined;
}

function unwrap(expression: ts.Expression): ts.Expression {
  let node = expression;
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
  )
    node = node.expression;
  return node;
}

function locate(
  source: ts.SourceFile,
  nodeOrOffset: ts.Node | number,
): { line: number; column: number } {
  const offset = typeof nodeOrOffset === 'number' ? nodeOrOffset : nodeOrOffset.getStart(source);
  const { line, character } = source.getLineAndCharacterOfPosition(offset);
  return { line: line + 1, column: character + 1 };
}

function locateText(text: string, offset: number): { line: number; column: number } {
  const prefix = text.slice(0, Math.max(0, offset));
  const lines = prefix.split(/\r\n|\n|\r/);
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

function isScriptFile(path: string): boolean {
  return /\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i.test(path) && !/\.d\.(?:ts|mts|cts)$/i.test(path);
}

function scriptKindOf(path: string): ts.ScriptKind {
  switch (/\.[^./\\]+$/.exec(path)?.[0].toLowerCase()) {
    case '.tsx':
      return ts.ScriptKind.TSX;
    case '.js':
    case '.mjs':
    case '.cjs':
      return ts.ScriptKind.JS;
    case '.jsx':
      return ts.ScriptKind.JSX;
    default:
      return ts.ScriptKind.TS;
  }
}

function normalizePath(path: string): string {
  const parts: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else if (part !== '..' || !path.startsWith('/')) parts.push(part);
  }
  return `${path.startsWith('/') ? '/' : ''}${parts.join('/')}`;
}

function resolveMemoryPath(componentPath: string, templatePath: string): string {
  const normalizedComponent = normalizePath(componentPath);
  const directory = normalizedComponent.includes('/')
    ? normalizedComponent.slice(0, normalizedComponent.lastIndexOf('/'))
    : '';
  return normalizePath(directory === '' ? templatePath : `${directory}/${templatePath}`);
}
