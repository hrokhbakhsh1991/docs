#!/usr/bin/env node
/**
 * I5 — API workspace HTTP handlers must load lazily via generated dynamic imports.
 * Wave G.b — per-package ensure path (not multi-product eager preload).
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
const appTs = path.join(REPO_ROOT, "apps/api/src/app.ts");

if (!existsSync(generatedLoaders)) {
  violations.push("workspace-http-handler-loaders.generated.ts missing — run generate:workspace-registry");
} else {
  const loaders = readFileSync(generatedLoaders, "utf8");
  if (!loaders.includes("export async function loadWorkspaceHttpPackageHandlers")) {
    violations.push("generated loaders must export loadWorkspaceHttpPackageHandlers()");
  }
  if (!loaders.includes("export async function ensureWorkspaceHttpHandler")) {
    violations.push("generated loaders must export ensureWorkspaceHttpHandler() (Wave G.b)");
  }
  if (!loaders.includes("export async function loadWorkspaceHttpHandlersForPackage")) {
    violations.push("generated loaders must export loadWorkspaceHttpHandlersForPackage() (Wave G.b)");
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
  if (!lazy.includes("ensureWorkspaceHttpHandler")) {
    violations.push("lazy-workspace-finance-handlers must call ensureWorkspaceHttpHandler (Wave G.b)");
  }
  if (!lazy.includes("resetWorkspaceHttpHandlerPackageCache")) {
    violations.push("lazy-workspace-finance-handlers must reset per-package handler cache (Wave G.b)");
  }
}

if (existsSync(appTs)) {
  const app = readFileSync(appTs, "utf8");
  if (app.includes("buildWorkspaceRouteHandlers") || app.includes("loadWorkspaceHttpPackageHandlers")) {
    violations.push("app.ts must not preload all HTTP handler packages (Wave G.b)");
  }
  if (!app.includes("resolveWorkspaceHttpHandler")) {
    violations.push("app.ts must dispatch via resolveWorkspaceHttpHandler (Wave G.b)");
  }
}

if (!existsSync(pluginRegistry)) {
  violations.push("workspace-plugin-registry.generated.ts missing");
} else {
  const registry = readFileSync(pluginRegistry, "utf8");
  if (!registry.includes("loadApiWorkspacePluginByIdFromManifest")) {
    violations.push("plugin registry must export loadApiWorkspacePluginByIdFromManifest()");
  }
  if (!/await import\("@app-tour\/workspace-/.test(registry)) {
    violations.push("plugin registry must use await import() for workspace packages");
  }
  if (/^import (?!type\b).+from "@app-tour\/workspace-(?!sdk")/m.test(registry)) {
    violations.push("plugin registry must not static-import workspace product packages");
  }
  if (/listApiWorkspacePluginsFromManifest\(\)\s*:\s*readonly WorkspacePlugin/.test(registry)) {
    violations.push("plugin registry must not eagerly sync-list WorkspacePlugin[] (P4.2)");
  }
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
