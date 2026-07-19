/**
 * Phase B1.9 — Booking application purity + guard-booking-boundary.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");
const GUARD = join(REPO_ROOT, "scripts/guards/guard-booking-boundary.mjs");
const FIXTURE = join(here, "test/fixtures/illegal-prisma-import.ts");
const SERVICE = join(here, "bookings.service.ts");

describe("BK-B1.9 booking application purity", () => {
  it("application surface passes guard-booking-boundary", () => {
    assert.equal(existsSync(GUARD), true);
    const r = spawnSync(process.execPath, [GUARD], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    assert.match(r.stdout, /PASS \(application surface\)/);
  });

  it("negative Prisma fixture fails guard when scanned", () => {
    assert.equal(existsSync(FIXTURE), true, `missing fixture: ${FIXTURE}`);
    const src = readFileSync(FIXTURE, "utf8");
    assert.match(src, /@prisma\/client/);
    assert.match(src, /NEGATIVE FIXTURE/);

    const r = spawnSync(
      process.execPath,
      [GUARD, "--scan-file", FIXTURE],
      { cwd: REPO_ROOT, encoding: "utf8" }
    );
    assert.notEqual(r.status, 0, "negative fixture must fail the boundary guard");
    assert.match(`${r.stdout}\n${r.stderr}`, /FAIL/);
    assert.match(`${r.stdout}\n${r.stderr}`, /@prisma/);
  });

  it("BookingsService has zero Prisma / workspace / env / console / HTTP / factory imports", () => {
    const src = readFileSync(SERVICE, "utf8");
    assert.doesNotMatch(src, /@prisma\/client/);
    assert.doesNotMatch(src, /@app-tour\/workspace-/);
    assert.doesNotMatch(src, /workspace-sdk/);
    assert.doesNotMatch(src, /process\.env/);
    assert.doesNotMatch(src, /console\.(log|info|warn|error)/);
    assert.doesNotMatch(src, /node:http/);
    assert.doesNotMatch(src, /getBookingsRepository|createBookingsRepository/);
    assert.doesNotMatch(src, /withTenantRls|enqueueOutboxEvent/);
    assert.doesNotMatch(src, /infrastructure\//);
    assert.doesNotMatch(src, /\.generated/);
    assert.match(src, /BookingRepositoryPort/);
    assert.match(src, /@app-tour\/booking-http-contracts/);
  });

  it("negative fixture is not imported by application sources", () => {
    const appFiles = [
      "bookings.service.ts",
      "bookings.types.ts",
      "bookings.errors.ts",
      "booking-payment-status.ts",
      "booking-list-query.ts",
      "bookings-member-summary-projection.ts",
    ];
    for (const rel of appFiles) {
      const src = readFileSync(join(here, rel), "utf8");
      assert.doesNotMatch(src, /illegal-prisma-import/);
      assert.doesNotMatch(src, /test\/fixtures/);
    }
  });
});
