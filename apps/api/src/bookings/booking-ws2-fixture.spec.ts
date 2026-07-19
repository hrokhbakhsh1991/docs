/**
 * Phase B1.3 — booking-ws2 architecture fixture (manifest + codegen registration proof).
 * No production wiring — service / repos / routes / composition must not import ws2.
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
import {
  isBookingDependencyBindingRegistered,
  listBookingDependencyWorkspaceTypes,
  resolveBookingWorkspaceDependencies,
} from "./booking-dependency-registry.ts";

const here = dirname(fileURLToPath(import.meta.url));
const WS2 = "booking-ws2";

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("BK-B1.3 booking-ws2 fixture", () => {
  it("booking-ws2 is recognized as a supported Booking workspace", () => {
    assert.equal(isBookingSupportedWorkspace(WS2), true);
    assert.equal(isBookingSupportedWorkspace("denali"), true);
    assert.equal(isBookingSupportedWorkspace("urban"), false);
    assert.ok(WORKSPACE_BOOKING_BINDINGS.some((b) => b.workspaceType === WS2));
    // registryOnly fixture: no defaultModuleEnabledWhenUnset unless declared
    assert.equal(defaultBookingEnabledWhenModulesUnset(WS2), false);
  });

  it("booking-ws2 dependencies resolve to WS2 registration adapters", () => {
    assert.equal(isBookingDependencyBindingRegistered(WS2), true);
    assert.deepEqual(listBookingDependencyWorkspaceTypes(), ["booking-ws2", "denali"].sort());
    const deps = resolveBookingWorkspaceDependencies(WS2);
    assert.equal(deps.workspaceType, WS2);
    assert.equal(deps.publicBooking.constructor.name, "BookingWs2PublicAdapter");
    assert.equal(deps.capacityPolicy.constructor.name, "BookingWs2CapacityPolicyAdapter");
    assert.equal(deps.validationPolicy.constructor.name, "BookingWs2ValidationPolicyAdapter");
    assert.equal(deps.opsCapability.constructor.name, "BookingWs2OpsCapabilityAdapter");
    assert.equal(deps.publicBooking.kind, "booking-ws2-public");
    assert.equal(deps.capacityPolicy.kind, "booking-ws2-capacity-policy");
    assert.notEqual(deps.publicBooking.kind, "denali-booking-public");
  });

  it("generated bindings import booking-ws2 package (manifest → codegen)", () => {
    const gate = read("workspace-booking-bindings.generated.ts");
    const deps = read("workspace-booking-dependency-bindings.generated.ts");
    assert.match(gate, /@app-tour\/workspace-booking-ws2/);
    assert.match(gate, /BOOKING_WS2_WORKSPACE_TYPE/);
    assert.match(deps, /@app-tour\/workspace-booking-ws2\/host\/booking/);
    assert.match(deps, /BookingWs2PublicAdapter/);
  });

  it("BookingsService / repositories / routes / composition untouched by ws2", () => {
    for (const rel of [
      "bookings.service.ts",
      "create-bookings-service.ts",
      "bookings.routes.ts",
      "prisma-bookings.repository.ts",
      "in-memory-bookings.repository.ts",
      "create-bookings-repository.ts",
      "ports/booking-repository.port.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /booking-ws2/);
      assert.doesNotMatch(src, /workspace-booking-ws2/);
      assert.doesNotMatch(src, /BookingWs2/);
    }
  });
});
