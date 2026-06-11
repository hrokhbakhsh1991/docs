#!/usr/bin/env node
/**
 * Phase 10.2 S4 — workspace plugin singletons only via generated registry (DEC-P10-001).
 * Blocks getStarterWorkspacePlugin / getDenaliWorkspacePlugin / getUrbanWorkspacePlugin
 * imports outside workspace-plugin-registry.generated.ts and *.spec.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

const PLUGIN_SINGLETON_PATTERN =
  /\b(getStarterWorkspacePlugin|getDenaliWorkspacePlugin|getUrbanWorkspacePlugin)\b/;

const ALLOWLIST = new Set([
  path.join(SRC, "workspace", "workspace-plugin-registry.generated.ts"),
]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === "dist") continue;
      walk(p, out);
    } else if (ent.name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

const violations = [];

for (const file of walk(SRC)) {
  if (ALLOWLIST.has(file)) continue;
  if (file.endsWith(".spec.ts")) continue;

  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, "utf8");
  if (!PLUGIN_SINGLETON_PATTERN.test(src)) continue;

  violations.push(
    `${rel}: workspace plugin singleton import/use — only workspace-plugin-registry.generated.ts may reference get*WorkspacePlugin`
  );
}

if (violations.length > 0) {
  console.error("guard-workspace-registry-imports: FAIL");
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}

console.log("guard-workspace-registry-imports: PASS");
