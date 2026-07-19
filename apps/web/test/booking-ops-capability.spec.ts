/**
 * Phase B1.6 — Booking ops capability bindings (Denali + booking-ws2 declare independently).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveBookingOpsCapabilityForHub } from "../src/features/bookings/booking-ops-panels.ts";
import {
  hasBookingOpsManifest,
  resolveWorkspaceBookingOpsManifest,
  WORKSPACE_BOOKING_OPS_PLUGIN_IDS,
} from "../src/bootstrap/workspace-booking-ops-bindings.generated.ts";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("BK-B1.6 booking ops capability", () => {
  it("Denali and booking-ws2 both registered with distinct manifest ids", () => {
    assert.equal(hasBookingOpsManifest("denali"), true);
    assert.equal(hasBookingOpsManifest("booking-ws2"), true);
    assert.ok(WORKSPACE_BOOKING_OPS_PLUGIN_IDS.has("denali"));
    assert.ok(WORKSPACE_BOOKING_OPS_PLUGIN_IDS.has("booking-ws2"));

    const denali = resolveWorkspaceBookingOpsManifest("denali");
    const ws2 = resolveWorkspaceBookingOpsManifest("booking-ws2");
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

  it("hub soft-resolve returns null for unbound pluginId", () => {
    assert.equal(resolveBookingOpsCapabilityForHub(null, "urban"), null);
    assert.equal(resolveBookingOpsCapabilityForHub(null, ""), null);
    assert.equal(resolveBookingOpsCapabilityForHub(null, "denali")?.id, "denali_registration_ops");
  });

  it("generated bindings import workspace host/bookings — not apps/api", () => {
    const src = readFileSync(
      resolve(WEB_ROOT, "src/bootstrap/workspace-booking-ops-bindings.generated.ts"),
      "utf8"
    );
    assert.match(src, /AUTO-GENERATED/);
    assert.match(src, /@app-tour\/workspace-denali\/host\/bookings/);
    assert.match(src, /@app-tour\/workspace-booking-ws2\/host\/bookings/);
    assert.doesNotMatch(src, /apps\/api/);
    assert.doesNotMatch(src, /BookingsService/);
    assert.doesNotMatch(src, /approveBooking/);
  });

  it("hub helper does not hard-import workspace packages", () => {
    const src = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-ops-panels.ts"),
      "utf8"
    );
    assert.doesNotMatch(src, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(src, /@app-tour\/workspace-booking-ws2/);
    assert.match(src, /workspace-booking-ops-bindings\.generated/);
  });
});
