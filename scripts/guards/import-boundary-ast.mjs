#!/usr/bin/env node
/**
 * AST-based import boundary guard (replaces line-scanner).
 * Scans package source, platform-core dist artifacts, and blocks dynamic eval/loaders.
 * Usage: node scripts/guards/import-boundary-ast.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guardRequire } from "./lib/guard-require.mjs";

const ts = guardRequire("typescript");

import {
  FOUNDATION_GATE_IMPORT_BOUNDARY_SCAN_ROOTS,
  IMPORT_BOUNDARY_DENALI_BREACH_ALLOWLIST,
  IMPORT_BOUNDARY_SCAN_ROOTS,
  resolveExistingRoots,
} from "./foundation-gate-config.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const IS_FOUNDATION_SCOPE = process.env.PHASE_0_GUARD_SCOPE === "foundation";

const scanRelRoots = IS_FOUNDATION_SCOPE
  ? FOUNDATION_GATE_IMPORT_BOUNDARY_SCAN_ROOTS
  : IMPORT_BOUNDARY_SCAN_ROOTS;

const SCAN_ROOTS = resolveExistingRoots(scanRelRoots).filter((p) => fs.existsSync(p));

const UI_PRIMITIVES_BARREL = /^@app-tour\/ui-primitives$/;
const UI_PRIMITIVES_ALLOWED_SUBPATHS = new Set([
  "button",
  "input",
  "field-shell",
  "alert",
  "badge",
]);

/** Post-build execution surface — foundation scans workspace-sdk dist only (H-12). */
const DIST_SCAN_ROOTS = IS_FOUNDATION_SCOPE
  ? [path.join(REPO_ROOT, "packages/workspace-sdk/dist")]
  : [
      path.join(REPO_ROOT, "packages/platform-core/dist"),
      path.join(REPO_ROOT, "packages/workspace-sdk/dist"),
    ];

/** Repo-relative file paths allowed to invoke createRequire-bound callables (empty for packages). */
const CREATE_REQUIRE_CALL_WHITELIST = new Set([]);

/** Substring/segment patterns — no ^ anchor so relative paths (e.g. ../../../legacy/) match. */
const FORBIDDEN = [
  /@app-tour\/workspaces\b/,
  /packages\/workspaces\//,
  /[/\\]workspaces[/\\]/,
  /[/\\]legacy[/\\]/,
  /legacy[/\\]/,
  /@repo[/\\]/,
  /packages[/\\]legacy/,
];

const FORBIDDEN_VM_SPECIFIERS = [/^vm$/, /^node:vm$/];

const VM_RUN_METHODS = new Set([
  "runInThisContext",
  "runInNewContext",
  "runInContext",
  "compileFunction",
  "compile",
]);

function listSourceFiles(dir) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === "dist") continue;
        walk(p);
      } else if (/\.(ts|tsx|mts|cts)$/.test(ent.name)) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

function listDistFiles(dir) {
  const out = [];
  const walk = (d) => {
    if (!fs.existsSync(d)) return;
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules") continue;
        walk(p);
      } else if (/\.(js|mjs|cjs)$/.test(ent.name)) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

function pushHit(hits, filePath, sf, node, spec, reason, lineOverride) {
  const line =
    lineOverride ??
    (sf && node
      ? sf.getLineAndCharacterOfPosition(node.pos).line + 1
      : 1);
  hits.push({
    file: filePath,
    spec,
    line,
    reason: reason ?? null,
  });
}

function isForbiddenModule(specText) {
  return FORBIDDEN.some((re) => re.test(specText));
}

function isUiPrimitivesBarrelImport(specText) {
  return UI_PRIMITIVES_BARREL.test(specText);
}

function isUiPrimitivesInvalidSubpath(specText) {
  const prefix = "@app-tour/ui-primitives/";
  if (!specText.startsWith(prefix)) {
    return false;
  }
  const sub = specText.slice(prefix.length).split("/")[0];
  return !UI_PRIMITIVES_ALLOWED_SUBPATHS.has(sub);
}

function recordUiPrimitivesImport(hits, filePath, sf, node, spec) {
  if (spec.dynamic) {
    return;
  }
  if (isUiPrimitivesBarrelImport(spec.text)) {
    pushHit(hits, filePath, sf, node, spec.text, "ui-primitives-barrel-import");
    return;
  }
  if (isUiPrimitivesInvalidSubpath(spec.text)) {
    pushHit(hits, filePath, sf, node, spec.text, "ui-primitives-unknown-subpath");
  }
}

function isForbiddenVmSpecifier(specText) {
  return FORBIDDEN_VM_SPECIFIERS.some((re) => re.test(specText));
}

function isImportMetaExpression(expr, sf) {
  if (ts.isMetaProperty(expr)) {
    return (
      expr.keyword.kind === ts.SyntaxKind.ImportKeyword &&
      expr.name.text === "meta"
    );
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return (
      expr.expression.getText(sf) === "import" && expr.name.getText(sf) === "meta"
    );
  }
  if (ts.isParenthesizedExpression(expr)) {
    return isImportMetaExpression(expr.expression, sf);
  }
  if (ts.isAsExpression(expr) || ts.isTypeAssertionExpression(expr)) {
    return isImportMetaExpression(expr.expression, sf);
  }
  if (ts.isSatisfiesExpression(expr)) {
    return isImportMetaExpression(expr.expression, sf);
  }
  const text = expr.getText(sf);
  return text === "import.meta" || text.startsWith("import.meta");
}

function checkImportMetaAccess(node, filePath, sf, hits) {
  if (!ts.isElementAccessExpression(node)) {
    return;
  }
  if (!isImportMetaExpression(node.expression, sf)) {
    return;
  }

  const arg = node.argumentExpression;
  const accessText = node.getText(sf);
  if (
    arg &&
    (ts.isStringLiteral(arg) ||
      ts.isNoSubstitutionTemplateLiteral(arg) ||
      (ts.isIdentifier(arg) && arg.text === "resolve"))
  ) {
    const prop =
      arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
        ? arg.text
        : arg.text;
    if (prop === "resolve") {
      pushHit(hits, filePath, sf, node, accessText, "import-meta-bracket-resolve");
      return;
    }
    pushHit(hits, filePath, sf, node, accessText, "import-meta-bracket-access");
    return;
  }

  pushHit(hits, filePath, sf, node, accessText, "import-meta-computed-access");
}

function moduleSpecFromExpression(expr, sf) {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { text: expr.text, dynamic: false };
  }
  if (ts.isTemplateExpression(expr)) {
    return {
      text: expr.getText(sf),
      dynamic: true,
      reason: "template-expression-module",
    };
  }
  return {
    text: expr.getText(sf),
    dynamic: true,
    reason: "computed-module",
  };
}

function collectImportEqualsSpecifiers(node, sf) {
  const specs = [];
  if (!ts.isImportEqualsDeclaration(node)) {
    return specs;
  }

  const ref = node.moduleReference;
  if (ts.isExternalModuleReference(ref) && ref.expression) {
    specs.push(moduleSpecFromExpression(ref.expression, sf));
    return specs;
  }

  specs.push({
    text: ref.getText(sf),
    dynamic: true,
    reason: "import-equals-internal-reference",
  });
  return specs;
}

function collectModuleSpecifiers(node, sf) {
  const specs = [];
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const spec = node.moduleSpecifier;
    if (!spec) {
      return specs;
    }
    const mod = moduleSpecFromExpression(spec, sf);
    specs.push(mod);
    if (!mod.dynamic && isForbiddenVmSpecifier(mod.text)) {
      specs.push({ text: mod.text, dynamic: false, reason: "forbidden-vm-import" });
    }
  }
  if (ts.isImportEqualsDeclaration(node)) {
    specs.push(...collectImportEqualsSpecifiers(node, sf));
  }
  return specs;
}

function recordModuleSpec(hits, filePath, sf, node, spec) {
  if (spec.reason === "forbidden-vm-import") {
    pushHit(hits, filePath, sf, node, spec.text, "forbidden-vm-import");
    return;
  }
  if (spec.dynamic) {
    pushHit(hits, filePath, sf, node, spec.text, spec.reason);
    return;
  }
  if (isForbiddenModule(spec.text)) {
    pushHit(hits, filePath, sf, node, spec.text, "forbidden-module");
  }
}

function isCreateRequireCall(node, sf) {
  if (!ts.isCallExpression(node)) {
    return false;
  }
  const expr = node.expression;
  if (ts.isIdentifier(expr) && expr.text === "createRequire") {
    return true;
  }
  if (ts.isPropertyAccessExpression(expr)) {
    return expr.name.getText(sf) === "createRequire";
  }
  return node.expression.getText(sf) === "createRequire";
}

function collectCreateRequireBindings(node, sf, bindings) {
  if (ts.isVariableDeclaration(node) && node.initializer && node.name && ts.isIdentifier(node.name)) {
    if (isCreateRequireCall(node.initializer, sf)) {
      bindings.add(node.name.text);
    }
  }
}

function checkDynamicEvaluators(node, filePath, sf, hits) {
  if (ts.isCallExpression(node)) {
    const expr = node.expression;
    const exprText = expr.getText(sf);

    if (ts.isIdentifier(expr) && expr.text === "eval") {
      pushHit(hits, filePath, sf, node, "eval()", "forbidden-dynamic-eval");
    }

    if (exprText === "Reflect.construct") {
      pushHit(hits, filePath, sf, node, exprText, "forbidden-reflect-construct");
    }

    if (ts.isPropertyAccessExpression(expr)) {
      const base = expr.expression.getText(sf);
      const method = expr.name.getText(sf);
      if ((base === "vm" || base.endsWith(".vm") || base === "node:vm") && VM_RUN_METHODS.has(method)) {
        pushHit(hits, filePath, sf, node, exprText, "forbidden-vm-runtime");
      }
    }
  }

  if (ts.isNewExpression(node)) {
    const expr = node.expression;
    if (ts.isIdentifier(expr) && expr.text === "Function") {
      pushHit(hits, filePath, sf, node, "new Function()", "forbidden-new-function");
    }
  }
}

function checkCreateRequireCalls(
  node,
  filePath,
  sf,
  hits,
  createRequireBindings,
  relFile,
) {
  if (CREATE_REQUIRE_CALL_WHITELIST.has(relFile)) {
    return;
  }

  if (!ts.isCallExpression(node)) {
    return;
  }

  if (ts.isCallExpression(node.expression) && isCreateRequireCall(node.expression, sf)) {
    pushHit(
      hits,
      filePath,
      sf,
      node,
      node.getText(sf),
      "create-require-direct-call",
    );
    return;
  }

  if (ts.isIdentifier(node.expression) && createRequireBindings.has(node.expression.text)) {
    const arg = node.arguments[0];
    if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
      if (isForbiddenModule(arg.text)) {
        pushHit(hits, filePath, sf, node, arg.text, "create-require-forbidden-module");
      } else {
        pushHit(hits, filePath, sf, node, arg.text, "create-require-literal-call");
      }
      return;
    }
    pushHit(
      hits,
      filePath,
      sf,
      node,
      node.getText(sf),
      "create-require-dynamic-call",
    );
  }
}

function checkFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits = [];
  const createRequireBindings = new Set();
  const relFile = path.relative(REPO_ROOT, filePath);

  const visit = (node) => {
    collectCreateRequireBindings(node, sf, createRequireBindings);

    checkImportMetaAccess(node, filePath, sf, hits);
    checkDynamicEvaluators(node, filePath, sf, hits);
    checkCreateRequireCalls(node, filePath, sf, hits, createRequireBindings, relFile);

    if (ts.isPropertyAccessExpression(node)) {
      const exprText = node.expression.getText(sf);
      if (exprText === "import.meta" && node.name.getText(sf) === "resolve") {
        pushHit(hits, filePath, sf, node, "import.meta.resolve", "import-meta-resolve");
      }
    }

    if (ts.isMetaProperty(node)) {
      if (
        node.keyword?.kind === ts.SyntaxKind.ImportKeyword &&
        node.name?.text === "meta"
      ) {
        const parent = node.parent;
        if (
          ts.isPropertyAccessExpression(parent) &&
          parent.name.getText(sf) === "resolve"
        ) {
          pushHit(hits, filePath, sf, node, "import.meta.resolve", "import-meta-resolve");
        }
      }
    }

    for (const spec of collectModuleSpecifiers(node, sf)) {
      recordModuleSpec(hits, filePath, sf, node, spec);
      recordUiPrimitivesImport(hits, filePath, sf, node, spec);
    }

    if (ts.isCallExpression(node)) {
      const expr = node.expression.getText(sf);
      if (expr === "require" && node.arguments[0]) {
        const arg = node.arguments[0];
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          if (isForbiddenModule(arg.text)) {
            pushHit(hits, filePath, sf, node, arg.text, "forbidden-require");
          }
        } else {
          pushHit(
            hits,
            filePath,
            sf,
            node,
            arg.getText(sf),
            "computed-require",
          );
        }
      }

      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const arg = node.arguments[0];
        if (!arg) {
          pushHit(hits, filePath, sf, node, "<dynamic import>", "dynamic-import-missing-arg");
        } else if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
          if (isForbiddenModule(arg.text)) {
            pushHit(hits, filePath, sf, node, arg.text, "forbidden-dynamic-import");
          }
        } else if (ts.isTemplateExpression(arg)) {
          pushHit(
            hits,
            filePath,
            sf,
            node,
            arg.getText(sf),
            "template-expression-dynamic-import",
          );
        } else {
          pushHit(
            hits,
            filePath,
            sf,
            node,
            arg.getText(sf),
            "computed-dynamic-import",
          );
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sf);
  return hits;
}

/** Dist scan: string/require patterns in emitted JS (execution surface). */
function scanDistFile(filePath) {
  const hits = [];
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(REPO_ROOT, filePath);

  for (const re of FORBIDDEN) {
    if (re.test(content)) {
      const idx = content.search(re);
      const line = idx >= 0 ? content.slice(0, idx).split("\n").length : 1;
      pushHit(hits, filePath, null, null, String(re), "dist-forbidden-substring", line);
    }
  }

  const requireStringRe =
    /require\s*\(\s*["'`]([^"'`]+)["'`]\s*\)|from\s+["'`]([^"'`]+)["'`]/g;
  let match;
  while ((match = requireStringRe.exec(content)) !== null) {
    const spec = match[1] ?? match[2];
    if (spec && isForbiddenModule(spec)) {
      const line = content.slice(0, match.index).split("\n").length;
      pushHit(hits, filePath, null, null, spec, "dist-forbidden-module", line);
    }
  }

  if (/\beval\s*\(/.test(content)) {
    pushHit(hits, filePath, null, null, "eval()", "dist-forbidden-eval", 1);
  }
  if (/\bnew\s+Function\s*\(/.test(content)) {
    pushHit(hits, filePath, null, null, "new Function()", "dist-forbidden-new-function", 1);
  }

  return hits;
}

function isImportBoundaryAllowlisted(filePath) {
  const rel = path.relative(REPO_ROOT, filePath).replaceAll("\\", "/");
  return IMPORT_BOUNDARY_DENALI_BREACH_ALLOWLIST.includes(rel);
}

function main() {
  const violations = [];

  for (const root of SCAN_ROOTS) {
    if (root.endsWith(`${path.sep}ui-primitives`) || root.includes(`${path.sep}ui-primitives${path.sep}`)) {
      continue;
    }
    for (const file of listSourceFiles(root)) {
      if (file.includes(`${path.sep}packages${path.sep}ui-primitives${path.sep}`)) {
        continue;
      }
      if (isImportBoundaryAllowlisted(file)) {
        continue;
      }
      violations.push(...checkFile(file));
    }
  }

  for (const distRoot of DIST_SCAN_ROOTS) {
    if (!fs.existsSync(distRoot)) {
      console.error(
        `import-boundary-ast: FAIL dist scan required (missing ${path.relative(REPO_ROOT, distRoot)} — run pnpm build)`,
      );
      process.exit(1);
    }
    for (const file of listDistFiles(distRoot)) {
      violations.push(...scanDistFile(file));
    }
  }

  if (violations.length === 0) {
    console.log("import-boundary-ast: PASS");
    return;
  }

  console.error("import-boundary-ast: FAIL");
  for (const v of violations) {
    const reason = v.reason ? ` [${v.reason}]` : "";
    console.error(`  ${path.relative(REPO_ROOT, v.file)}:${v.line} ${v.spec}${reason}`);
  }
  process.exit(1);
}

main();
