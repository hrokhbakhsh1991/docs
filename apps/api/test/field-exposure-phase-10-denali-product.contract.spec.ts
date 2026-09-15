import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const REPO_ROOT = join(process.cwd(), "..", "..");
const EXPOSURE_DOC = join(REPO_ROOT, "docs/architecture/field-exposure-system.md");
const GUARD_SCRIPT = join(REPO_ROOT, "scripts/guards/field-exposure-phase-10-guard.mjs");
const DISPATCH_ROUTES = join(REPO_ROOT, "apps/api/src/openapi/dispatch-routes.ts");
const CATALOG_BINDINGS = join(
  REPO_ROOT,
  "packages/workspaces/denali/src/catalog/denali-catalog-exposure-bindings.ts",
);
const GENERATE_SCRIPT = join(REPO_ROOT, "scripts/generate-denali-settings-modules.mjs");

describe("field exposure phase 10 Denali product + enterprise ops contract (M3/M4)", () => {
  it("documents M3/M4 governance and runtime authority clarification", () => {
    const text = readFileSync(EXPOSURE_DOC, "utf8");
    assert.match(text, /## Enterprise Closure — Milestone M3 \(Denali Product\)/);
    assert.match(text, /## Enterprise Closure — Milestone M4 \(Enterprise Ops\)/);
    assert.match(text, /### Phase 8 vs runtime authority \(M4 doc alignment\)/);
    assert.match(text, /field-exposure-denali-reminder-feed\.spec\.ts/);
    assert.match(text, /guard:field-exposure-phase-10/);
  });

  it("registers Denali dashboard and reminder feed routes in OpenAPI inventory", () => {
    const routes = readFileSync(DISPATCH_ROUTES, "utf8");
    assert.match(routes, /\/denali\/dashboard\/tours\/\{tourId\}/);
    assert.match(routes, /\/denali\/reminders\/feed/);
    assert.match(routes, /getDenaliDashboardTour/);
    assert.match(routes, /getDenaliReminderFeed/);
  });

  it("includes approximate-return-time in catalog bindings for PDP redaction", () => {
    const bindings = readFileSync(CATALOG_BINDINGS, "utf8");
    assert.equal(bindings.includes("denali.approximate-return-time"), true);
  });

  it("supports denali settings module codegen with --check", () => {
    assert.ok(existsSync(GENERATE_SCRIPT));
    const script = readFileSync(GENERATE_SCRIPT, "utf8");
    assert.match(script, /--check/);
    const result = spawnSync("node", [GENERATE_SCRIPT, "--check"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "generate:denali-settings-modules --check failed",
    );
  });

  it("runs field-exposure-phase-10-guard successfully", () => {
    assert.ok(existsSync(GUARD_SCRIPT));
    const result = spawnSync("node", [GUARD_SCRIPT], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(
      result.status,
      0,
      result.stderr || result.stdout || "field-exposure-phase-10-guard failed",
    );
  });
});
