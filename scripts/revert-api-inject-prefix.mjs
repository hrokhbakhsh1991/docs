#!/usr/bin/env node
/**
 * Restore constructor-injected field names in apps/api (undo _ prefix on DI members).
 *
 *   node scripts/revert-api-inject-prefix.mjs           # dry-run
 *   node scripts/revert-api-inject-prefix.mjs --write   # apply
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const API_ROOT = path.join(REPO_ROOT, "apps/api");
const WRITE = process.argv.includes("--write");

const requireFromWeb = createRequire(path.join(REPO_ROOT, "apps/web/package.json"));
const ts = requireFromWeb("typescript");

const INJECT_DECORATORS = new Set([
  "Inject",
  "InjectDataSource",
  "InjectRepository",
  "InjectQueue",
  "Optional",
]);

function listTsFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      listTsFiles(p, out);
    } else if (ent.name.endsWith(".ts") && !ent.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

function hasModifier(param, kind) {
  return param.modifiers?.some((m) => m.kind === kind) ?? false;
}

function paramHasInjectDecorator(param) {
  return (
    param.decorators?.some((dec) => {
      const expr = dec.expression;
      if (ts.isCallExpression(expr)) {
        const callee = expr.expression;
        if (ts.isIdentifier(callee)) return INJECT_DECORATORS.has(callee.text);
        if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.name)) {
          return INJECT_DECORATORS.has(callee.name.text);
        }
      }
      if (ts.isIdentifier(expr)) return INJECT_DECORATORS.has(expr.text);
      return false;
    }) ?? false
  );
}

function shouldRevertParameterProperty(param) {
  if (!isParameterProperty(param)) return false;
  const name = param.name;
  if (!ts.isIdentifier(name) || !name.text.startsWith("_")) return false;
  if (paramHasInjectDecorator(param)) return true;
  if (
    hasModifier(param, ts.SyntaxKind.PrivateKeyword) &&
    hasModifier(param, ts.SyntaxKind.ReadonlyKeyword)
  ) {
    return true;
  }
  // Public `constructor(readonly profile)` used for interface fields (e.g. IWorkspaceStrategy).
  if (
    hasModifier(param, ts.SyntaxKind.ReadonlyKeyword) &&
    !hasModifier(param, ts.SyntaxKind.PrivateKeyword) &&
    !hasModifier(param, ts.SyntaxKind.ProtectedKeyword)
  ) {
    return true;
  }
  return false;
}

function isParameterProperty(param) {
  return (
    hasModifier(param, ts.SyntaxKind.PrivateKeyword) ||
    hasModifier(param, ts.SyntaxKind.ProtectedKeyword) ||
    hasModifier(param, ts.SyntaxKind.PublicKeyword) ||
    hasModifier(param, ts.SyntaxKind.ReadonlyKeyword)
  );
}

function shouldRevertPropertyDeclaration(node) {
  if (!ts.isPropertyDeclaration(node)) return false;
  const name = node.name;
  if (!ts.isIdentifier(name) || !name.text.startsWith("_")) return false;
  if (!hasModifier(node, ts.SyntaxKind.PrivateKeyword)) return false;
  if (!hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)) return false;
  const inject =
    node.decorators?.some((dec) => {
      const expr = dec.expression;
      if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
        return INJECT_DECORATORS.has(expr.expression.text);
      }
      return false;
    }) ?? false;
  return inject;
}

function applyChanges(filePath, changes) {
  if (changes.length === 0) return 0;
  const sorted = [...changes].sort((a, b) => b.start - a.start);
  let text = fs.readFileSync(filePath, "utf8");
  for (const c of sorted) {
    text = text.slice(0, c.start) + c.text + text.slice(c.end);
  }
  if (WRITE) fs.writeFileSync(filePath, text);
  return changes.length;
}

function processFile(filePath) {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const sf = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const changes = [];

  const visit = (node) => {
    if (ts.isConstructorDeclaration(node)) {
      for (const param of node.parameters) {
        if (!shouldRevertParameterProperty(param)) continue;
        const name = param.name;
        changes.push({
          start: name.getStart(sf),
          end: name.getEnd(),
          text: name.text.slice(1),
        });
      }
    }
    if (shouldRevertPropertyDeclaration(node)) {
      const name = node.name;
      changes.push({
        start: name.getStart(sf),
        end: name.getEnd(),
        text: name.text.slice(1),
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  const n = applyChanges(filePath, changes);
  if (n > 0) {
    console.log(`${WRITE ? "fixed" : "would fix"} ${path.relative(REPO_ROOT, filePath)} (${n})`);
  }
  return n;
}

let total = 0;
for (const file of listTsFiles(API_ROOT)) {
  total += processFile(file);
}

/** Enum members wrongly prefixed (e.g. _PENDING = "pending"). */
function revertEnumMemberPrefixes(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const next = text.replace(/^(\s+)_([A-Z][A-Za-z0-9_]*)(\s*=)/gm, "$1$2$3");
  if (next === text) return 0;
  if (WRITE) fs.writeFileSync(filePath, next);
  console.log(`${WRITE ? "fixed enums" : "would fix enums"} ${path.relative(REPO_ROOT, filePath)}`);
  return 1;
}

const enumRoots = [
  path.join(API_ROOT, "src"),
  path.join(REPO_ROOT, "packages/shared"),
];
let enumFiles = 0;
for (const root of enumRoots) {
  if (!fs.existsSync(root)) continue;
  for (const file of listTsFiles(root)) {
    enumFiles += revertEnumMemberPrefixes(file);
  }
}

console.log(
  `${WRITE ? "Reverted" : "Would revert"} ${total} injected field name(s); ${enumFiles} enum file(s) in apps/api + packages/shared`,
);
if (!WRITE && (total > 0 || enumFiles > 0)) process.exit(0);
