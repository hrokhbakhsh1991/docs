/**
 * I0 — AST walker for shell appearance violations (className + icon metrics).
 */
import fs from "node:fs";
import path from "node:path";
import { guardRequire } from "./guard-require.mjs";

const ts = guardRequire("typescript");

/** Tailwind / layout tokens that belong in workspace skin, not shell TSX. */
export const APPEARANCE_PATTERN =
  /(?:^|\s)(?:bg-|text-|border-|shadow-|backdrop-|rounded-|font-|px-|py-|gap-|flex\b|min-h-|sr-only|focus:|hidden\b|sticky\b|shrink-|overflow-|max-w|w-\[|md:|start-|h-|w-)/;

/** @typedef {{ surface: string; files: string[]; exempt?: string[] }} ShellAppearanceScope */

/** @type {ShellAppearanceScope[]} */
export const SHELL_APPEARANCE_SCOPES = [
  {
    surface: "marketing",
    files: [
      "apps/marketing/src/shell/marketing-shell.tsx",
      "apps/marketing/src/shell/marketing-footer.tsx",
      "apps/marketing/src/shell/marketing-providers.tsx",
    ],
  },
  {
    surface: "portal-me",
    files: [
      "apps/portal/app/me/[...modulePath]/page.tsx",
      "apps/portal/app/me/home/page.tsx",
      "apps/portal/app/me/layout.tsx",
      "apps/portal/app/me/more/page.tsx",
      "apps/portal/app/me/page.tsx",
      "apps/portal/app/me/profile/member-profile-avatar.tsx",
      "apps/portal/app/me/profile/member-profile-form.tsx",
      "apps/portal/app/me/profile/member-profile-mobile-change.tsx",
      "apps/portal/app/me/profile/page.tsx",
      "apps/portal/app/me/registrations/[id]/member-receipt-upload-form.tsx",
      "apps/portal/app/me/registrations/[id]/page.tsx",
      "apps/portal/app/me/registrations/page.tsx"
    ],
  },
  {
    surface: "portal",
    files: [
      "apps/portal/src/shell/portal-member-shell.tsx",
      "apps/portal/src/shell/portal-member-header.tsx",
      "apps/portal/src/shell/portal-member-bottom-nav.tsx",
      "apps/portal/src/shell/portal-member-user-menu.tsx",
    ],
  },
  {
    surface: "admin",
    files: [
      "apps/web/src/admin/shell/operator-shell.tsx",
      "apps/web/src/admin/shell/operator-header.tsx",
      "apps/web/src/admin/shell/operator-nav.tsx",
      "apps/web/src/admin/shell/operator-account-menu.tsx",
    ],
  },
];

/**
 * @param {import("typescript").Expression} expr
 * @returns {string[]}
 */
export function extractExpressionStrings(expr) {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return [expr.text];
  }
  if (ts.isTemplateExpression(expr)) {
    let combined = expr.head.text;
    for (const span of expr.templateSpans) {
      combined += span.literal.text;
    }
    return [combined];
  }
  if (ts.isBinaryExpression(expr) && expr.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [
      ...extractExpressionStrings(expr.left),
      ...extractExpressionStrings(expr.right),
    ];
  }
  if (ts.isConditionalExpression(expr)) {
    return [
      ...extractExpressionStrings(expr.whenTrue),
      ...extractExpressionStrings(expr.whenFalse),
    ];
  }
  if (ts.isCallExpression(expr)) {
    return expr.arguments.flatMap((arg) => extractExpressionStrings(arg));
  }
  if (ts.isParenthesizedExpression(expr)) {
    return extractExpressionStrings(expr.expression);
  }
  return [];
}

/**
 * @param {import("typescript").Node} attrNode
 * @param {import("typescript").SourceFile} sf
 */
function jsxTagNameForAttribute(attrNode, sf) {
  let parent = attrNode.parent;
  while (parent) {
    if (ts.isJsxOpeningElement(parent)) {
      return parent.tagName.getText(sf);
    }
    parent = parent.parent;
  }
  return "";
}

const ICON_METRIC_EXEMPT_TAGS = new Set([
  "Button",
  "Input",
  "SelectTrigger",
  "DropdownMenuTrigger",
  "Toggle",
]);

/**
 * @param {import("typescript").Node} node
 * @param {import("typescript").SourceFile} sf
 * @param {string} relPath
 * @param {string} surface
 * @param {string[]} violations
 */
function visitShellNode(node, sf, relPath, surface, violations) {
  if (ts.isJsxAttribute(node)) {
    const name = node.name.getText(sf);
    const tagName = jsxTagNameForAttribute(node, sf);
    if (name === "className" && node.initializer) {
      /** @type {string[]} */
      let texts = [];
      if (ts.isStringLiteral(node.initializer)) {
        texts = [node.initializer.text];
      } else if (
        ts.isJsxExpression(node.initializer) &&
        node.initializer.expression
      ) {
        texts = extractExpressionStrings(node.initializer.expression);
      }
      for (const text of texts) {
        if (APPEARANCE_PATTERN.test(text)) {
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
          violations.push(
            `${relPath}:${line + 1} [${surface}] appearance className "${text.trim()}"`
          );
        }
      }
    }
    if (name === "strokeWidth" && node.initializer) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      violations.push(
        `${relPath}:${line + 1} [${surface}] Lucide strokeWidth prop (skin owns icon metrics)`
      );
    }
    if (name === "size" && node.initializer && !ICON_METRIC_EXEMPT_TAGS.has(tagName)) {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      violations.push(
        `${relPath}:${line + 1} [${surface}] Lucide size prop on <${tagName}> (skin owns icon metrics)`
      );
    }
  }
  ts.forEachChild(node, (child) => visitShellNode(child, sf, relPath, surface, violations));
}

/**
 * @param {string} repoRoot
 * @param {ShellAppearanceScope[]} [scopes]
 * @returns {{ violations: string[]; scanned: number }}
 */
export function scanShellAppearance(repoRoot, scopes = SHELL_APPEARANCE_SCOPES) {
  /** @type {string[]} */
  const violations = [];
  let scanned = 0;

  for (const scope of scopes) {
    const exempt = new Set(scope.exempt ?? []);
    for (const rel of scope.files) {
      if (exempt.has(rel)) {
        continue;
      }
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) {
        violations.push(`${rel} [${scope.surface}] missing shell file`);
        continue;
      }
      scanned += 1;
      const source = fs.readFileSync(abs, "utf8");
      const sf = ts.createSourceFile(
        rel,
        source,
        ts.ScriptTarget.Latest,
        true,
        rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      );
      visitShellNode(sf, sf, rel, scope.surface, violations);
    }
  }

  return { violations, scanned };
}
