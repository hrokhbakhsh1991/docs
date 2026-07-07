#!/usr/bin/env node
/**
 * I5 — API workspace HTTP handlers must load lazily via generated dynamic imports.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const generatedLoaders = path.join(
  REPO_ROOT,
  "apps/api/src/http/workspace-http-handler-loaders.generated.ts"
);
const lazyWorkspaceHandlers = path.join(
  REPO_ROOT,
  "apps/api/src/boot/lazy-workspace-finance-handlers.ts"
);
const workspacePlugins = path.join(REPO_ROOT, "apps/api/src/workspace/workspace-plugins.ts");
const pluginRegistry = path.join(
  REPO_ROOT,
  "apps/api/src/workspace/workspace-plugin-registry.generated.ts"
);

if (!existsSync(generatedLoaders)) {
  violations.push("workspace-http-handler-loaders.generated.ts missing — run generate:workspace-registry");
} else {
  const loaders = readFileSync(generatedLoaders, "utf8");
  if (!loaders.includes("export async function loadWorkspaceHttpPackageHandlers")) {
    violations.push("generated loaders must export loadWorkspaceHttpPackageHandlers()");
  }
  if (!/await import\("@app-tour\/workspace-/.test(loaders)) {
    violations.push("generated loaders must use await import() for workspace HTTP packages");
  }
  if (/^import .+ from "@app-tour\/workspace-/m.test(loaders)) {
    violations.push("generated loaders must not static-import workspace HTTP packages at top level");
  }
}

if (!existsSync(lazyWorkspaceHandlers)) {
  violations.push("lazy-workspace-finance-handlers.ts missing");
} else {
  const lazy = readFileSync(lazyWorkspaceHandlers, "utf8");
  if (!lazy.includes("loadWorkspaceHttpPackageHandlers")) {
    violations.push("lazy-workspace-finance-handlers must call loadWorkspaceHttpPackageHandlers()");
  }
  if (!lazy.includes("workspacePackageHandlersPromise")) {
    violations.push("lazy-workspace-finance-handlers must cache handler promise (lazy on first use)");
  }
}

if (!existsSync(pluginRegistry)) {
  violations.push("workspace-plugin-registry.generated.ts missing");
}

if (!existsSync(workspacePlugins)) {
  violations.push("workspace-plugins.ts missing");
} else {
  const plugins = readFileSync(workspacePlugins, "utf8");
  if (!plugins.includes("listApiWorkspacePluginsFromManifest")) {
    violations.push("listApiWorkspacePlugins must use manifest-generated registry");
  }
}

const urbanShimDir = path.join(REPO_ROOT, "apps/api/src/urban");
if (existsSync(urbanShimDir)) {
  violations.push("apps/api/src/urban/ shims forbidden — use generated lazy loaders");
}

if (violations.length > 0) {
  console.error("guard-api-lazy-plugin-registry: FAIL");
  for (const v of violations) {
    console.error(`  - ${v}`);
  }
  process.exit(1);
}

console.log("guard-api-lazy-plugin-registry: PASS");
