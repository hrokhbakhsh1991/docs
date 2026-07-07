#!/usr/bin/env node
/**
 * P9 surface boundary — enforces p9-package-boundary.yaml guard_rules_to_add.
 * @see docs/phase-22/p9-package-boundary.yaml
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const failures = [];

function rg(pattern, paths, { invert = false } = {}) {
  const args = ["rg", pattern, ...paths, "--glob", "*.ts", "--glob", "*.tsx"];
  if (invert) {
    args.push("--glob", "!**/node_modules/**");
  }
  const result = spawnSync(args[0], args.slice(1), {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  const matched = (result.stdout || "").trim().length > 0;
  return invert ? !matched : matched;
}

function assertCheck(id, ok, detail) {
  if (!ok) {
    failures.push(`${id}: ${detail}`);
    console.error(`FAIL ${id}: ${detail}`);
    return;
  }
  console.log(`PASS ${id}`);
}

function exists(rel) {
  return fs.existsSync(path.join(REPO_ROOT, rel));
}

// P9-SURF-01 — web must not contain public-auth BFF routes
assertCheck(
  "P9-SURF-01",
  !exists("apps/web/app/api/public-auth") ||
    spawnSync("find", ["apps/web/app/api/public-auth", "-name", "route.ts"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).stdout.trim().length === 0,
  "apps/web/app/api/public-auth route.ts files still exist"
);

// P9-SURF-02 — M+P must not define local PHASE_43_HOST_TENANT_IDS
assertCheck(
  "P9-SURF-02",
  !rg("PHASE_43_HOST_TENANT_IDS", ["apps/marketing", "apps/portal"]),
  "marketing or portal still define PHASE_43_HOST_TENANT_IDS locally"
);

// P9-SURF-03 — web must not import guest-surface-host
assertCheck(
  "P9-SURF-03",
  !rg("guest-surface-host", ["apps/web"]),
  "apps/web imports @app-tour/guest-surface-host"
);

// P9-PKG-01 — guest-surface-host must not import from apps/
assertCheck(
  "P9-PKG-01",
  !rg('from ["\']apps/', ["packages/guest-surface-host"]),
  "guest-surface-host imports from apps/*"
);

// Post-P9 forbidden modules removed from web
for (const rel of [
  "apps/web/src/tenant/resolve-public-catalog-bootstrap.server.ts",
  "apps/web/src/tenant/resolve-multi-level-host.ts",
]) {
  assertCheck(`P9-FORBID-${path.basename(rel)}`, !exists(rel), `${rel} still exists`);
}

// M+P bootstrap must use guest-surface-host (no local resolve-host-tenant)
assertCheck(
  "P9-BOOT-M+P",
  !rg("resolve-host-tenant", ["apps/marketing", "apps/portal"]),
  "marketing or portal still reference local resolve-host-tenant"
);

assertCheck(
  "P9-BOOT-M+P-IMPORT",
  rg("@app-tour/guest-surface-host", ["apps/marketing", "apps/portal"]),
  "marketing and portal must import guest-surface-host"
);

if (failures.length > 0) {
  console.error(`guard:p9-surface-boundary FAIL (${failures.length} check(s))`);
  process.exit(1);
}

console.log("guard:p9-surface-boundary PASS");
