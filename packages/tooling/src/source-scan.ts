import ts from 'typescript';

/**
 * One place a recognised Etyma call passes a message key. `key` is the literal's value, or
 * `undefined` when the argument is not a literal and so cannot be known statically.
 *
 * Plain data on purpose: the analysis that consumes it never sees a syntax tree, so a future
 * scanner for another syntax (an Angular template, an Astro file) can produce the same
 * thing.
 */
export interface KeyReference {
  readonly key: string | undefined;
  readonly line: number;
  readonly column: number;
}

export interface ParseProblem {
  readonly line: number;
  readonly column: number;
  readonly message: string;
}

export interface SourceScan {
  readonly references: readonly KeyReference[];
  readonly parseProblems: readonly ParseProblem[];
}

/**
 * What an expression evaluates to, as far as this scanner can prove from syntax alone.
 *
 * - `callable`: a function that takes a message key first — `injectT()`'s result, or the
 *   `t`/`parts`/`translate` member of an object below.
 * - `i18n`: an object with `t()` and `parts()`, from `injectI18n()` or `createAstroI18n()`.
 * - `translator`: `createTranslator()`'s result, with `translate()` and `translateToParts()`.
 */
type Kind = 'callable' | 'i18n' | 'translator';

/**
 * Canonical Etyma factories, by the package that exports them. The scanner follows the
 * binding an import creates, never the name — `import { injectT as useT }` works, and a
 * function called `injectT` from anywhere else does not.
 */
const FACTORIES: ReadonlyMap<string, ReadonlyMap<string, Kind>> = new Map([
  [
    '@etyma/angular',
    new Map<string, Kind>([
      ['injectT', 'callable'],
      ['injectI18n', 'i18n'],
    ]),
  ],
  ['@etyma/astro', new Map<string, Kind>([['createAstroI18n', 'i18n']])],
  ['@etyma/core', new Map<string, Kind>([['createTranslator', 'translator']])],
]);

/** Members of each object kind that take a message key first. */
const KEY_MEMBERS: ReadonlyMap<Kind, ReadonlySet<string>> = new Map([
  ['i18n', new Set(['t', 'parts'])],
  ['translator', new Set(['translate', 'translateToParts'])],
]);

/**
 * What a name means in some scope. Anything this scanner does not positively recognise is
 * `other`, and `other` still matters: it is what stops a parameter named `t` from inheriting
 * the meaning of a module-level `t`.
 */
type Binding =
  | { readonly type: 'import'; readonly module: string; readonly name: string }
  | { readonly type: 'namespace'; readonly module: string }
  | { readonly type: 'etyma'; readonly kind: Kind }
  | { readonly type: 'other' };

const OTHER: Binding = { type: 'other' };

class Scope {
  readonly bindings = new Map<string, Binding>();

  constructor(readonly parent: Scope | undefined) {}

  resolve(name: string): Binding | undefined {
    return this.bindings.get(name) ?? this.parent?.resolve(name);
  }
}

/**
 * Finds every message key passed to a recognised Etyma translator in one JavaScript or
 * TypeScript source text.
 *
 * Syntax only: no type checker, no module resolution, nothing is executed. What it can
 * prove is deliberately narrow — see the package README for the exact patterns — and anything
 * it cannot prove is left out rather than guessed.
 */
export function scanSource(path: string, source: string, parsedFile?: unknown): SourceScan {
  const file =
    (parsedFile as ts.SourceFile | undefined) ??
    ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      /* setParentNodes: needed to resolve `this` */ true,
      scriptKindOf(path),
    );

  const references: KeyReference[] = [];
  const classFields = new Map<ts.Node, Map<string, Kind>>();

  const locate = (node: ts.Node) => {
    const { line, character } = file.getLineAndCharacterOfPosition(node.getStart(file));
    return { line: line + 1, column: character + 1 };
  };

  // --- what an expression is -------------------------------------------------------------

  function kindOf(expression: ts.Expression, scope: Scope): Kind | undefined {
    const node = unwrap(expression, true);

    if (ts.isIdentifier(node)) {
      const binding = scope.resolve(node.text);
      return binding?.type === 'etyma' ? binding.kind : undefined;
    }

    if (ts.isCallExpression(node)) {
      return factoryKind(node, scope);
    }

    if (ts.isPropertyAccessExpression(node)) {
      const name = node.name.text;

      if (node.expression.kind === ts.SyntaxKind.ThisKeyword) {
        const owner = enclosingClass(node);
        return owner === undefined ? undefined : classFields.get(owner)?.get(name);
      }

      const object = kindOf(node.expression, scope);
      return object !== undefined && KEY_MEMBERS.get(object)?.has(name) === true
        ? 'callable'
        : undefined;
    }

    return undefined;
  }

  function factoryKind(call: ts.CallExpression, scope: Scope): Kind | undefined {
    const callee = unwrap(call.expression, false);

    if (ts.isIdentifier(callee)) {
      const binding = scope.resolve(callee.text);
      return binding?.type === 'import'
        ? FACTORIES.get(binding.module)?.get(binding.name)
        : undefined;
    }

    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression)) {
      const binding = scope.resolve(callee.expression.text);
      return binding?.type === 'namespace'
        ? FACTORIES.get(binding.module)?.get(callee.name.text)
        : undefined;
    }

    return undefined;
  }

  // --- what a scope declares -------------------------------------------------------------

  /**
   * Registers a scope's own declarations. Every name becomes `other` first, so that a local
   * declaration shadows an outer one even before (or without) being recognised; only then
   * are `const` declarations whose value is a recognised Etyma translator promoted.
   * `let` and `var` are never promoted, because a reassigned binding proves nothing.
   */
  function declare(statements: readonly ts.Statement[], scope: Scope): void {
    for (const statement of statements) {
      if (ts.isVariableStatement(statement)) {
        for (const declaration of statement.declarationList.declarations) {
          declareNames(declaration.name, scope);
        }
      } else if (
        (ts.isFunctionDeclaration(statement) ||
          ts.isClassDeclaration(statement) ||
          ts.isEnumDeclaration(statement) ||
          ts.isModuleDeclaration(statement)) &&
        statement.name !== undefined &&
        ts.isIdentifier(statement.name)
      ) {
        scope.bindings.set(statement.name.text, OTHER);
      } else if (ts.isImportEqualsDeclaration(statement)) {
        scope.bindings.set(statement.name.text, OTHER);
      }
    }

    for (const statement of statements) {
      if (
        ts.isVariableStatement(statement) &&
        (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      ) {
        for (const declaration of statement.declarationList.declarations) {
          promote(declaration, scope);
        }
      }
    }
  }

  function promote(declaration: ts.VariableDeclaration, scope: Scope): void {
    if (declaration.initializer === undefined) return;

    const kind = kindOf(declaration.initializer, scope);
    if (kind === undefined) return;

    if (ts.isIdentifier(declaration.name)) {
      scope.bindings.set(declaration.name.text, { type: 'etyma', kind });
      return;
    }

    // `const { t, parts: p } = i18n`: a plain member of the object, bound to a local name.
    if (ts.isObjectBindingPattern(declaration.name) && kind !== 'callable') {
      for (const element of declaration.name.elements) {
        const member = element.propertyName ?? element.name;

        if (
          element.dotDotDotToken === undefined &&
          ts.isIdentifier(element.name) &&
          ts.isIdentifier(member) &&
          KEY_MEMBERS.get(kind)?.has(member.text) === true
        ) {
          scope.bindings.set(element.name.text, { type: 'etyma', kind: 'callable' });
        }
      }
    }
  }

  function declareNames(name: ts.BindingName, scope: Scope): void {
    if (ts.isIdentifier(name)) {
      scope.bindings.set(name.text, OTHER);
      return;
    }

    for (const element of name.elements) {
      if (!ts.isOmittedExpression(element)) declareNames(element.name, scope);
    }
  }

  /** `var` is function-scoped: it belongs to the nearest function (or file), however deep. */
  function declareHoisted(node: ts.Node, scope: Scope): void {
    ts.forEachChild(node, child => {
      if (isScopeBoundary(child)) return;

      if (ts.isVariableDeclarationList(child) && (child.flags & ts.NodeFlags.BlockScoped) === 0) {
        for (const declaration of child.declarations) declareNames(declaration.name, scope);
      }
      declareHoisted(child, scope);
    });
  }

  function declareImports(statements: readonly ts.Statement[], scope: Scope): void {
    for (const statement of statements) {
      if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) continue;

      const { importClause } = statement;
      const module = ts.isStringLiteral(statement.moduleSpecifier)
        ? statement.moduleSpecifier.text
        : undefined;
      const etyma = module !== undefined && FACTORIES.has(module);

      if (importClause.name !== undefined) {
        scope.bindings.set(importClause.name.text, OTHER);
      }

      const { namedBindings } = importClause;
      if (namedBindings === undefined) continue;

      if (ts.isNamespaceImport(namedBindings)) {
        scope.bindings.set(
          namedBindings.name.text,
          etyma && importClause.phaseModifier === undefined ? { type: 'namespace', module } : OTHER,
        );
        continue;
      }

      for (const element of namedBindings.elements) {
        scope.bindings.set(
          element.name.text,
          etyma && importClause.phaseModifier === undefined && !element.isTypeOnly
            ? { type: 'import', module, name: (element.propertyName ?? element.name).text }
            : OTHER,
        );
      }
    }
  }

  // --- the walk --------------------------------------------------------------------------

  function visit(node: ts.Node, scope: Scope): void {
    if (ts.isTypeNode(node) || ts.isImportDeclaration(node)) return;

    let inner = scope;

    if (isFunctionLike(node)) {
      inner = new Scope(scope);

      if (ts.isFunctionExpression(node) && node.name !== undefined) {
        inner.bindings.set(node.name.text, OTHER);
      }
      for (const parameter of node.parameters) declareNames(parameter.name, inner);
      if (node.body !== undefined) declareHoisted(node.body, inner);
    } else if (ts.isBlock(node) || ts.isModuleBlock(node)) {
      inner = new Scope(scope);
      declare(node.statements, inner);
    } else if (ts.isCaseBlock(node)) {
      inner = new Scope(scope);
      declare(
        node.clauses.flatMap(clause => clause.statements),
        inner,
      );
    } else if (
      (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
      node.initializer !== undefined &&
      ts.isVariableDeclarationList(node.initializer)
    ) {
      inner = new Scope(scope);
      for (const declaration of node.initializer.declarations) {
        declareNames(declaration.name, inner);
      }
    } else if (ts.isCatchClause(node) && node.variableDeclaration !== undefined) {
      inner = new Scope(scope);
      declareNames(node.variableDeclaration.name, inner);
    } else if (ts.isClassLike(node)) {
      recordFields(node, scope);
    } else if (ts.isCallExpression(node)) {
      recordReference(node, scope);
    }

    ts.forEachChild(node, child => {
      visit(child, inner);
    });
  }

  function recordFields(node: ts.ClassLikeDeclaration, scope: Scope): void {
    const fields = new Map<string, Kind>();
    classFields.set(node, fields);

    for (const member of node.members) {
      if (
        !ts.isPropertyDeclaration(member) ||
        member.initializer === undefined ||
        isStatic(member) ||
        !(ts.isIdentifier(member.name) || ts.isPrivateIdentifier(member.name))
      ) {
        continue;
      }

      const kind = kindOf(member.initializer, scope);
      if (kind !== undefined) fields.set(member.name.text, kind);
    }
  }

  function recordReference(call: ts.CallExpression, scope: Scope): void {
    if (kindOf(call.expression, scope) !== 'callable') return;

    const argument = call.arguments[0];
    if (argument === undefined) return;

    const { line, column } = locate(argument);
    const literal = ts.isSpreadElement(argument) ? undefined : unwrap(argument, false);
    const key =
      literal !== undefined &&
      (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal))
        ? literal.text
        : undefined;

    references.push({ key, line, column });
  }

  const moduleScope = new Scope(undefined);
  declareImports(file.statements, moduleScope);
  declare(file.statements, moduleScope);
  declareHoisted(file, moduleScope);
  ts.forEachChild(file, child => {
    visit(child, moduleScope);
  });

  return { references, parseProblems: parseProblemsOf(file) };
}

/**
 * Removes syntax that cannot change a value at runtime: parentheses, `as`, `satisfies`, `<T>`
 * assertions and `!`. `await` only when asked, because it is transparent to "what is this
 * translator" but not to "what is this key".
 */
function unwrap(expression: ts.Expression, throughAwait: boolean): ts.Expression {
  let node = expression;

  for (;;) {
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isTypeAssertionExpression(node) ||
      ts.isNonNullExpression(node) ||
      (throughAwait && ts.isAwaitExpression(node))
    ) {
      node = node.expression;
    } else {
      return node;
    }
  }
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration
  | ts.ConstructorDeclaration
  | ts.GetAccessorDeclaration
  | ts.SetAccessorDeclaration;

function isFunctionLike(node: ts.Node): node is FunctionLike {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/** Where `var` hoisting stops. */
function isScopeBoundary(node: ts.Node): boolean {
  return isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node);
}

function isStatic(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.StaticKeyword) === true
  );
}

/**
 * The class whose instance `this` is at `node`, or `undefined` when it is something else:
 * inside a plain function, an object literal's method, a static member or a static block.
 * Arrow functions do not rebind `this`.
 */
function enclosingClass(node: ts.Node): ts.ClassLikeDeclaration | undefined {
  for (let current = node.parent; !ts.isSourceFile(current); current = current.parent) {
    if (ts.isArrowFunction(current)) continue;

    if (ts.isClassLike(current)) return current;

    if (
      ts.isMethodDeclaration(current) ||
      ts.isConstructorDeclaration(current) ||
      ts.isGetAccessorDeclaration(current) ||
      ts.isSetAccessorDeclaration(current) ||
      ts.isPropertyDeclaration(current)
    ) {
      if (!ts.isClassLike(current.parent) || isStatic(current)) return undefined;
      continue;
    }

    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isClassStaticBlockDeclaration(current)
    ) {
      return undefined;
    }
  }

  return undefined;
}

/**
 * Picks the parser mode from the extension alone — the path is a label, never read. An
 * extension that is not recognised falls back to TypeScript, which also accepts plain
 * JavaScript; only the JSX-in-`.js` and `<T>expr` readings differ, and those need an
 * extension that says so.
 */
function scriptKindOf(path: string): ts.ScriptKind {
  const extension = /\.[^./\\]*$/.exec(path)?.[0].toLowerCase();

  switch (extension) {
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

/**
 * The syntax errors TypeScript found while parsing. They hang off the parsed file as
 * `parseDiagnostics`, which TypeScript does not declare publicly; the only public route to
 * them is building a whole program, which this scanner deliberately never does. The
 * malformed-source tests fail if a TypeScript upgrade ever stops providing the field.
 */
function parseProblemsOf(file: ts.SourceFile): readonly ParseProblem[] {
  const { parseDiagnostics } = file as unknown as {
    readonly parseDiagnostics?: readonly ts.DiagnosticWithLocation[];
  };

  return (parseDiagnostics ?? []).map(diagnostic => {
    const { line, character } = file.getLineAndCharacterOfPosition(diagnostic.start);

    return {
      line: line + 1,
      column: character + 1,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    };
  });
}
