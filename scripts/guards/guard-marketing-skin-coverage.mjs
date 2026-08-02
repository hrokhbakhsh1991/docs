#!/usr/bin/env node
/**
 * MKT-15d — marketing skin coverage per manifest workspace.
 * Requires header, footer, catalog-toolbar, catalog-card, PDP hero hooks.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKSPACES = path.join(REPO_ROOT, "packages/workspaces");

const REQUIRED_HOOKS = [
  "header[data-marketing-header]",
  "footer[data-marketing-footer]",
  "div[data-marketing-catalog-toolbar]",
  "article[data-marketing-catalog-card]",
  "figure[data-marketing-catalog-detail-cover]",
];

/** @type {string[]} */
const violations = [];

function readSkinBundle(workspaceId, marketingPaths) {
  let combined = "";
  for (const relative of marketingPaths) {
    const abs = path.join(WORKSPACES, workspaceId, relative);
    if (!existsSync(abs)) {
      violations.push(`${workspaceId}: missing marketing skin ${relative}`);
      continue;
    }
    const css = readFileSync(abs, "utf8");
    combined += `\n${css}`;
    if (css.includes("@import")) {
      const dir = path.dirname(abs);
      for (const match of css.matchAll(/@import\s+["']\.\/([^"']+)["']/g)) {
        const imported = path.join(dir, match[1]);
        if (existsSync(imported)) {
          combined += `\n${readFileSync(imported, "utf8")}`;
          const componentsDir = path.join(path.dirname(imported), "components");
          if (existsSync(componentsDir)) {
            for (const file of readdirSync(componentsDir)) {
              if (file.endsWith(".css")) {
                combined += `\n${readFileSync(path.join(componentsDir, file), "utf8")}`;
              }
            }
          }
        }
      }
    }
  }
  return combined;
}

for (const id of readdirSync(WORKSPACES)) {
  const manifestPath = path.join(WORKSPACES, id, "workspace.manifest.json");
  if (!existsSync(manifestPath)) {
    continue;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  // Stub scaffolds (explicit or Phase H default omitted tier) may wire marketing
  // CSS paths without certified data-marketing-* hook skins.
  const productionTier = manifest.guestConformance?.productionTier ?? "stub";
  if (productionTier !== "certified") {
    continue;
  }
  const marketingSkins = manifest.guestThemeStylesheets?.marketing;
  if (!Array.isArray(marketingSkins) || marketingSkins.length === 0) {
    continue;
  }

  const scope = `body[data-app-surface="marketing"][data-workspace-plugin="${manifest.id}"]`;
  const bundle = readSkinBundle(id, marketingSkins);
  if (!bundle.includes(scope)) {
    violations.push(`${id}: marketing skin must include scoped selector ${scope}`);
  }

  for (const hook of REQUIRED_HOOKS) {
    if (!bundle.includes(hook)) {
      violations.push(`${id}: marketing skin missing hook ${hook}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-marketing-skin-coverage: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-marketing-skin-coverage: PASS");
