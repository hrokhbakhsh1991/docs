#!/usr/bin/env node
/**
 * PF-4.1 / G4 — API host must not retain workspace product shims or inline /urban dispatch.
 * @see docs/phase-10/subphases/10.3-http-route-registrar.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** @type {string[]} */
const violations = [];

const appTs = path.join(REPO_ROOT, "apps/api/src/app.ts");
const urbanShimDir = path.join(REPO_ROOT, "apps/api/src/urban");
const lazyHandlers = path.join(REPO_ROOT, "apps/api/src/boot/lazy-route-handlers.ts");
const lazyWorkspaceHandlers = path.join(
  REPO_ROOT,
  "apps/api/src/boot/lazy-workspace-finance-handlers.ts"
);
const registrar = path.join(REPO_ROOT, "apps/api/src/http/workspace-route-registrar.ts");
const generatedRoutes = path.join(
  REPO_ROOT,
  "apps/api/src/http/workspace-http-routes.generated.ts"
);

if (fs.existsSync(urbanShimDir)) {
  violations.push("apps/api/src/urban/ must not exist — use @app-tour/workspace-*/http");
}

const appSource = fs.readFileSync(appTs, "utf8");
if (/["']\/urban\//.test(appSource)) {
  violations.push('apps/api/src/app.ts must not contain "/urban/" product path literals');
}
if (/from "\.\/urban\//.test(appSource) || /from "\.\.\/urban\//.test(appSource)) {
  violations.push("apps/api/src/app.ts must not import from ./urban shims");
}

const lazySource = fs.readFileSync(lazyHandlers, "utf8");
if (/\/urban\//.test(lazySource)) {
  violations.push("lazy-route-handlers.ts must not import apps/api/src/urban shims");
}

const workspaceLazySource = fs.readFileSync(lazyWorkspaceHandlers, "utf8");
if (/urbanHandlers|handleGetUrban/.test(workspaceLazySource)) {
  violations.push(
    "lazy-workspace-finance-handlers.ts must load handlers only from workspace-http-handler-loaders.generated.ts"
  );
}
if (!workspaceLazySource.includes("loadWorkspaceHttpPackageHandlers")) {
  violations.push("lazy-workspace-finance-handlers.ts must call loadWorkspaceHttpPackageHandlers()");
}

const registrarSource = fs.readFileSync(registrar, "utf8");
const generatedSource = fs.readFileSync(generatedRoutes, "utf8");
const handlerKeyMatch = generatedSource.match(
  /export type WorkspaceHttpHandlerKey =\n([\s\S]*?);\n\nexport type WorkspaceHttpStaticRoute/
);
if (handlerKeyMatch === null) {
  violations.push("workspace-http-routes.generated.ts: WorkspaceHttpHandlerKey union not found");
} else {
  const handlerKeys = [...handlerKeyMatch[1].matchAll(/\| "([^"]+)"/g)].map((match) => match[1]);
  for (const handlerKey of handlerKeys) {
    if (!new RegExp(`\\b${handlerKey}:`).test(registrarSource)) {
      violations.push(`workspace-route-registrar.ts missing HANDLER_DISPATCH_KIND for ${handlerKey}`);
    }
  }
}

if (violations.length > 0) {
  console.error("guard-guest-api-shell: FAIL");
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log("guard-guest-api-shell: PASS");
