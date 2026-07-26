/**
 * Phase B1.6 — Booking ops capability (Denali + booking-ws2 declare independently).
 * Phase 4bf — hub soft-resolve via capabilities.bookingOps (binder deleted).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveBookingOpsCapabilityForHub } from "../src/features/bookings/booking-ops-panels.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("BK-B1.6 booking ops capability", () => {
  it("Denali and booking-ws2 both resolve with distinct manifest ids", async () => {
    const denali = await resolveBookingOpsCapabilityForHub(null, "denali");
    const ws2 = await resolveBookingOpsCapabilityForHub(null, "booking-ws2");
    assert.ok(denali);
    assert.ok(ws2);
    assert.equal(denali.id, "denali_registration_ops");
    assert.equal(ws2.id, "booking_ws2_registration_ops");
    assert.notEqual(denali.id, ws2.id);
    assert.equal(denali.actions.bulkApprove.maxBatch, 25);
    assert.equal(ws2.actions.bulkApprove.maxBatch, 10);
    assert.equal(denali.actions.reject.requiresReason, false);
    assert.equal(ws2.actions.reject.requiresReason, true);
    assert.ok(denali.views.includes("tour_board"));
    assert.equal(ws2.views.includes("tour_board"), false);
  });

  it("hub soft-resolve returns null for unbound pluginId", async () => {
    assert.equal(await resolveBookingOpsCapabilityForHub(null, "urban"), null);
    assert.equal(await resolveBookingOpsCapabilityForHub(null, ""), null);
    assert.equal(
      (await resolveBookingOpsCapabilityForHub(null, "denali"))?.id,
      "denali_registration_ops"
    );
  });

  it("hub helper does not hard-import workspace packages or deleted binder", () => {
    const src = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-ops-panels.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /@app-cloud\/workspace-denali/);
    assert.doesNotMatch(src, /@app-cloud\/workspace-booking-ws2/);
    assert.doesNotMatch(src, /workspace-booking-ops-bindings/);
    assert.match(src, /resolveBookingOpsCapability/);
    assert.match(src, /loadBootstrapWorkspacePlugin/);
  });
});
