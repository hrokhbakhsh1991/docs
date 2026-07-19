/**
 * Phase B1.0 — Booking capability gate uses generated bindings only.
 * Gate APIs exist; not wired into service / routes / repositories (runtime unchanged).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  defaultBookingEnabledWhenModulesUnset,
  isBookingSupportedWorkspace,
  WORKSPACE_BOOKING_BINDINGS,
} from "./workspace-booking-bindings.generated.ts";

const here = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("BK-B1.0 booking capability gate", () => {
  it("generated bindings support denali + booking-ws2; reject urban / unknown", () => {
    assert.equal(isBookingSupportedWorkspace("denali"), true);
    assert.equal(isBookingSupportedWorkspace("booking-ws2"), true);
    assert.equal(isBookingSupportedWorkspace("urban"), false);
    assert.equal(isBookingSupportedWorkspace("finance-ws3"), false);
    assert.equal(defaultBookingEnabledWhenModulesUnset("denali"), true);
    assert.equal(defaultBookingEnabledWhenModulesUnset("booking-ws2"), false);
    assert.equal(defaultBookingEnabledWhenModulesUnset("urban"), false);
  });

  it("WORKSPACE_BOOKING_BINDINGS lists denali + booking-ws2", () => {
    const types = WORKSPACE_BOOKING_BINDINGS.map((b) => b.workspaceType).sort();
    assert.deepEqual(types, ["booking-ws2", "denali"]);
    const denali = WORKSPACE_BOOKING_BINDINGS.find((b) => b.workspaceType === "denali");
    assert.equal(denali?.defaultModuleEnabledWhenUnset, true);
  });

  it("generated file is marked AUTO-GENERATED and exports gate APIs", () => {
    const src = read("workspace-booking-bindings.generated.ts");
    assert.match(src, /AUTO-GENERATED/);
    assert.match(src, /export function isBookingSupportedWorkspace/);
    assert.match(src, /export function defaultBookingEnabledWhenModulesUnset/);
    assert.doesNotMatch(src, /\[["']denali["']\]/);
    assert.doesNotMatch(src, /workspaceType === ["']denali["']/);
  });

  it("BookingsService has no capability-gate wiring (runtime unchanged)", () => {
    const src = read("bookings.service.ts");
    assert.doesNotMatch(src, /workspace-booking-bindings/);
    assert.doesNotMatch(src, /isBookingSupportedWorkspace/);
    assert.doesNotMatch(src, /defaultBookingEnabledWhenModulesUnset/);
    assert.doesNotMatch(src, /WORKSPACE_BOOKING_BINDINGS/);
    assert.doesNotMatch(src, /validBookingWorkspaces/);
    assert.doesNotMatch(src, /workspaceType === ["']denali["']/);
  });

  it("repositories have no capability-gate wiring", () => {
    for (const rel of [
      "prisma-bookings.repository.ts",
      "in-memory-bookings.repository.ts",
      "create-bookings-repository.ts",
      "ports/booking-repository.port.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /workspace-booking-bindings/);
      assert.doesNotMatch(src, /isBookingSupportedWorkspace/);
      assert.doesNotMatch(src, /defaultBookingEnabledWhenModulesUnset/);
    }
  });

  it("routes / composition façades have no capability-gate wiring", () => {
    for (const rel of ["bookings.routes.ts", "create-bookings-service.ts"]) {
      const src = read(rel);
      assert.doesNotMatch(src, /workspace-booking-bindings/);
      assert.doesNotMatch(src, /isBookingSupportedWorkspace/);
      assert.doesNotMatch(src, /defaultBookingEnabledWhenModulesUnset/);
    }
  });
});
