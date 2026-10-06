import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { classifyPaths } from "../ci/ci-impact.mjs";

const PHASE_6_WORKFLOW = readFileSync(
  new URL("../../.github/workflows/phase-6-gate.yml", import.meta.url),
  "utf8"
);
const PHASE_8_WORKFLOW = readFileSync(
  new URL("../../.github/workflows/phase-8-gate.yml", import.meta.url),
  "utf8"
);

test("documentation-only changes stay narrow", () => {
  const result = classifyPaths(["docs/dev/README.md"]);
  assert.equal(result.full, false);
  assert.deepEqual(result.domains, ["docs"]);
  assert.equal(result.tiers.postgres, false);
  assert.deepEqual(result.gateNodes, []);
  assert.deepEqual(result.phase6, {
    runFastClosure: false,
    runMinio: false,
    runBrowser: false,
  });
});

test("operator booking changes select booking and browser coverage", () => {
  const result = classifyPaths([
    "apps/web/src/bookings/BookingCancellationPanel.tsx",
    "apps/web/test/booking-smoke.spec.ts",
  ]);
  assert.deepEqual(result.domains, ["web", "booking"]);
  assert.equal(result.tiers.playwright, true);
  assert.equal(result.full, false);
  assert.ok(result.gateNodes.includes("l3.e2e"));
  assert.deepEqual(result.phase6, {
    runFastClosure: true,
    runMinio: false,
    runBrowser: true,
  });
});

test("marketing-only changes use the marketing rail instead of broad Phase 6 jobs", () => {
  const result = classifyPaths([
    "apps/marketing/src/home/home-marketing-assets.ts",
    "apps/marketing/test/home-section-gates-v4.spec.ts",
  ]);
  assert.deepEqual(result.domains, ["marketing"]);
  assert.equal(result.tiers.playwright, true);
  assert.deepEqual(result.phase6, {
    runFastClosure: false,
    runMinio: false,
    runBrowser: false,
  });
});

test("Phase 6 expensive jobs consume the classifier plan", () => {
  assert.match(PHASE_6_WORKFLOW, /name: Classify Phase 6 impact/);
  assert.match(PHASE_6_WORKFLOW, /needs: classify\n\s+if:.*run_fast_closure/);
  assert.match(PHASE_6_WORKFLOW, /needs: classify\n\s+if:.*run_minio/);
  assert.match(PHASE_6_WORKFLOW, /needs: classify\n\s+if:.*run_browser/);
});

test("ordinary operator web changes skip Urban regression and browser jobs", () => {
  const result = classifyPaths(["apps/web/app/(app)/tours/tours-page-client.tsx"]);
  assert.deepEqual(result.phase8, {
    runUrbanRegression: false,
    runBrowser: false,
  });
});

test("Urban changes retain Phase 8 regression and browser coverage", () => {
  const result = classifyPaths(["apps/web/tests/e2e/urban-catalog-access.spec.ts"]);
  assert.deepEqual(result.phase8, {
    runUrbanRegression: true,
    runBrowser: true,
  });
});

test("Phase 8 expensive jobs consume the classifier plan", () => {
  assert.match(PHASE_8_WORKFLOW, /name: Classify Phase 8 impact/);
  assert.match(PHASE_8_WORKFLOW, /needs: \[guard, classify\]/);
  assert.match(PHASE_8_WORKFLOW, /run_urban_regression/);
  assert.match(PHASE_8_WORKFLOW, /run_browser/);
});

test("API finance changes include database-aware finance coverage", () => {
  const result = classifyPaths(["apps/api/src/finance/receipt.service.ts"]);
  assert.deepEqual(result.domains, ["api", "finance"]);
  assert.equal(result.tiers.postgres, true);
  assert.ok(result.gateNodes.includes("l3.postgres"));
  assert.equal(result.phase6.runFastClosure, true);
  assert.equal(result.phase6.runMinio, true);
});

test("Denali workspace changes fan out to all Denali surfaces", () => {
  const result = classifyPaths(["packages/workspaces/denali/src/booking-plugin.ts"]);
  assert.deepEqual(result.domains, [
    "api",
    "web",
    "portal",
    "marketing",
    "booking",
    "finance",
    "ticketing",
    "workspace-denali",
  ]);
  assert.equal(result.full, false);
  assert.deepEqual(result.gateNodes, [
    "l0.node-engine",
    "l1.boundaries",
    "l1.typecheck",
    "l1.unit",
    "l3.cw-closure",
  ]);
});

test("booking HTTP contracts stay scoped without falling back to full impact", () => {
  const result = classifyPaths(["packages/booking-http-contracts/src/booking-http-types.ts"]);
  assert.deepEqual(result.domains, ["api", "web", "portal", "booking"]);
  assert.equal(result.full, false);
  assert.equal(result.tiers.postgres, true);
  assert.deepEqual(result.unknownPaths, []);
});

test("guest surface host changes cover its three consumers", () => {
  const result = classifyPaths(["packages/guest-surface-host/src/index.ts"]);
  assert.deepEqual(result.domains, ["web", "portal", "marketing"]);
  assert.equal(result.full, false);
  assert.deepEqual(result.unknownPaths, []);
  assert.deepEqual(result.phase6, {
    runFastClosure: true,
    runMinio: false,
    runBrowser: true,
  });
});

test("deployment environment changes are full impact but not unknown", () => {
  const result = classifyPaths(["deploy/vps/env/portal.env.example"]);
  assert.equal(result.full, true);
  assert.deepEqual(result.unknownPaths, []);
});

test("shared control-plane changes fail closed", () => {
  const result = classifyPaths([".github/workflows/phase-5-gate.yml", "pnpm-lock.yaml"]);
  assert.equal(result.full, true);
  assert.deepEqual(result.domains, [
    "api",
    "web",
    "portal",
    "marketing",
    "booking",
    "finance",
    "ticketing",
    "workspace-denali",
    "security",
    "docs",
  ]);
  assert.equal(result.tiers.playwright, true);
  assert.ok(result.gateNodes.includes("l2.integration"));
  assert.ok(result.gateNodes.includes("l3.cw-closure"));
});

test("unknown paths are explicitly recorded and fail closed", () => {
  const result = classifyPaths(["vendor/new-build-system.toml"]);
  assert.equal(result.full, true);
  assert.deepEqual(result.unknownPaths, ["vendor/new-build-system.toml"]);
});

test("classification is deterministic and deduplicates paths", () => {
  const left = classifyPaths([
    "apps/portal/src/a.tsx",
    "apps/api/src/tours/a.ts",
    "apps/portal/src/a.tsx",
  ]);
  const right = classifyPaths(["apps/api/src/tours/a.ts", "apps/portal/src/a.tsx"]);
  assert.deepEqual(left, right);
});
