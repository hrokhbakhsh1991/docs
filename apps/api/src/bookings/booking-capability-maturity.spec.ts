/**
 * Booking capability matrix — supported workspaces + resolvable deps (behavioral gate).
 * No decorative is* / list* registry helpers; ops UI is opsManifest → web only.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { getBookingWorkspaceCapabilities } from "./workspace-booking-capabilities.generated.ts";
import { isBookingSupportedWorkspace } from "./workspace-booking-bindings.generated.ts";

describe("booking supported workspace capability matrix", () => {
  it("denali + booking-ws2: supported, graded caps, resolvable deps", () => {
    assert.equal(isBookingSupportedWorkspace("denali"), true);
    assert.equal(isBookingSupportedWorkspace("booking-ws2"), true);

    const denali = getBookingWorkspaceCapabilities("denali");
    const ws2 = getBookingWorkspaceCapabilities("booking-ws2");
    assert.ok(denali);
    assert.ok(ws2);

    assert.equal(denali.enabled, true);
    assert.equal(ws2.enabled, true);
    assert.deepEqual(denali.capacity, { enabled: true, mode: "booking-owned" });
    assert.deepEqual(ws2.capacity, { enabled: true, mode: "booking-owned" });
    assert.deepEqual(denali.eventReaction, { enabled: true, mode: "in-process" });
    assert.deepEqual(ws2.eventReaction, { enabled: true, mode: "in-process" });
    assert.equal(denali.validation.mode, "base-shape");
    assert.equal(ws2.validation.mode, "base-shape");
    assert.equal(denali.publicCreate.mode, "create-pipeline");
    assert.equal(ws2.publicCreate.mode, "create-pipeline");
    assert.equal(denali.approval.mode, "host-lifecycle");
    assert.equal(ws2.approval.mode, "host-lifecycle");

    const depsDenali = resolveBookingWorkspaceDependencies("denali");
    const depsWs2 = resolveBookingWorkspaceDependencies("booking-ws2");
    assert.equal(depsDenali.workspaceType, "denali");
    assert.equal(depsWs2.workspaceType, "booking-ws2");
    assert.equal(depsDenali.capacityPolicy.kind, "denali-booking-capacity-policy");
    assert.equal(depsWs2.capacityPolicy.kind, "booking-ws2-capacity-policy");
    assert.notEqual(depsDenali.capacityPolicy.kind, depsWs2.capacityPolicy.kind);
  });

  it("fails closed: unsupported workspaces claim no caps and cannot resolve deps", () => {
    for (const wt of ["urban", "starter", "finance-ws5", "finance-ws2"]) {
      assert.equal(getBookingWorkspaceCapabilities(wt), null);
      assert.equal(isBookingSupportedWorkspace(wt), false);
      assert.throws(
        () => resolveBookingWorkspaceDependencies(wt),
        (error: unknown) =>
          error instanceof Error &&
          error.message.startsWith("BOOKING_WORKSPACE_DEPENDENCIES_UNSUPPORTED:")
      );
    }
  });
});
