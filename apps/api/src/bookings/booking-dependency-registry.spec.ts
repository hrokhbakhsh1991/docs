/**
 * Phase B1.1 / B1.8 — Booking dependency registry from generated bindings.
 * Thin `booking-dependency-registry.ts` re-exports generated maps (Finance mirror).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isBookingDependencyBindingRegistered,
  listBookingDependencyWorkspaceTypes,
  resolveBookingWorkspaceDependencies,
  WORKSPACE_BOOKING_DEPENDENCY_BINDINGS,
} from "./booking-dependency-registry.ts";

const here = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(here, rel), "utf8");
}

describe("BK-B1.1 booking dependency registry", () => {
  it("generated bindings register denali and booking-ws2", () => {
    assert.equal(isBookingDependencyBindingRegistered("denali"), true);
    assert.equal(isBookingDependencyBindingRegistered("DENALI"), true);
    assert.equal(isBookingDependencyBindingRegistered("booking-ws2"), true);
    assert.equal(isBookingDependencyBindingRegistered("urban"), false);
    assert.deepEqual(listBookingDependencyWorkspaceTypes(), ["booking-ws2", "denali"]);
    assert.equal(Object.keys(WORKSPACE_BOOKING_DEPENDENCY_BINDINGS).length, 2);
  });

  it("resolveBookingWorkspaceDependencies returns Denali registration adapters", () => {
    const deps = resolveBookingWorkspaceDependencies("denali");
    assert.equal(deps.workspaceType, "denali");
    assert.equal(deps.publicBooking.constructor.name, "DenaliBookingPublicAdapter");
    assert.equal(deps.capacityPolicy.constructor.name, "DenaliBookingCapacityPolicyAdapter");
    assert.equal(deps.validationPolicy.constructor.name, "DenaliBookingValidationPolicyAdapter");
    assert.equal(deps.opsCapability.constructor.name, "DenaliBookingOpsCapabilityAdapter");
    assert.equal(deps.publicBooking.kind, "denali-booking-public");
    assert.equal(deps.capacityPolicy.kind, "denali-booking-capacity-policy");
    assert.equal(deps.validationPolicy.kind, "denali-booking-validation-policy");
    assert.equal(deps.opsCapability.kind, "denali-booking-ops-capability");
  });

  it("unknown / empty workspaceType fails closed", () => {
    assert.throws(
      () => resolveBookingWorkspaceDependencies("urban"),
      (error: unknown) =>
        error instanceof Error &&
        error.message.startsWith("BOOKING_WORKSPACE_DEPENDENCIES_UNSUPPORTED:") &&
        error.message.includes("urban")
    );
    assert.throws(
      () => resolveBookingWorkspaceDependencies("   "),
      (error: unknown) =>
        error instanceof Error && error.message.startsWith("BOOKING_WORKSPACE_TYPE_REQUIRED:")
    );
  });

  it("generated file is AUTO-GENERATED and imports manifest-declared Denali adapters", () => {
    const src = read("workspace-booking-dependency-bindings.generated.ts");
    assert.match(src, /AUTO-GENERATED/);
    assert.match(src, /export function resolveBookingWorkspaceDependencies/);
    assert.match(src, /DenaliBookingPublicAdapter/);
    assert.match(src, /DenaliBookingCapacityPolicyAdapter/);
    assert.match(src, /DenaliBookingValidationPolicyAdapter/);
    assert.match(src, /DenaliBookingOpsCapabilityAdapter/);
    assert.match(src, /@app-tour\/workspace-denali\/host\/booking/);
    assert.doesNotMatch(src, /workspaceType === ["']denali["']/);
  });

  it("thin registry has no workspace package imports (B1.8)", () => {
    const src = read("booking-dependency-registry.ts");
    assert.doesNotMatch(src, /@app-tour\/workspace-/);
    assert.match(src, /workspace-booking-dependency-bindings\.generated/);
  });

  it("BookingsService has no dependency registry / adapter imports", () => {
    const src = read("bookings.service.ts");
    assert.doesNotMatch(src, /workspace-booking-dependency-bindings/);
    assert.doesNotMatch(src, /booking-dependency-registry/);
    assert.doesNotMatch(src, /resolveBookingWorkspaceDependencies/);
    assert.doesNotMatch(src, /WORKSPACE_BOOKING_DEPENDENCY_BINDINGS/);
    assert.doesNotMatch(src, /DenaliBookingCapacityPolicyAdapter/);
    assert.doesNotMatch(src, /DenaliBookingValidationPolicyAdapter/);
  });

  it("repositories have no dependency registry wiring", () => {
    for (const rel of [
      "prisma-bookings.repository.ts",
      "in-memory-bookings.repository.ts",
      "create-bookings-repository.ts",
      "ports/booking-repository.port.ts",
    ]) {
      const src = read(rel);
      assert.doesNotMatch(src, /workspace-booking-dependency-bindings/);
      assert.doesNotMatch(src, /resolveBookingWorkspaceDependencies/);
    }
  });

  it("routes have no dependency registry wiring; composition uses thin registry only", () => {
    assert.doesNotMatch(read("bookings.routes.ts"), /resolveBookingWorkspaceDependencies/);
    const composition = read("create-bookings-service.ts");
    assert.match(composition, /booking-dependency-registry/);
    assert.doesNotMatch(composition, /@app-tour\/workspace-/);
    assert.doesNotMatch(composition, /workspace-booking-dependency-bindings\.generated/);
  });
});
