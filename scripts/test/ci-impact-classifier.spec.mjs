import assert from "node:assert/strict";
import test from "node:test";
import { classifyPaths } from "../ci/ci-impact.mjs";

test("documentation-only changes stay narrow", () => {
  const result = classifyPaths(["docs/dev/README.md"]);
  assert.equal(result.full, false);
  assert.deepEqual(result.domains, ["docs"]);
  assert.equal(result.tiers.postgres, false);
});

test("operator booking changes select booking and browser coverage", () => {
  const result = classifyPaths([
    "apps/web/src/bookings/BookingCancellationPanel.tsx",
    "apps/web/test/booking-smoke.spec.ts",
  ]);
  assert.deepEqual(result.domains, ["web", "booking"]);
  assert.equal(result.tiers.playwright, true);
  assert.equal(result.full, false);
});

test("API finance changes include database-aware finance coverage", () => {
  const result = classifyPaths(["apps/api/src/finance/receipt.service.ts"]);
  assert.deepEqual(result.domains, ["api", "finance"]);
  assert.equal(result.tiers.postgres, true);
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
});

test("booking HTTP contracts stay scoped without falling back to full impact", () => {
  const result = classifyPaths(["packages/booking-http-contracts/src/booking-http-types.ts"]);
  assert.deepEqual(result.domains, ["api", "web", "portal", "booking"]);
  assert.equal(result.full, false);
  assert.equal(result.tiers.postgres, true);
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
