/**
 * Thin Shell Phase 4bf — bookingOps capability + binder retirement.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { getWorkspacePlugin as getBookingWs2Plugin } from "@app-cloud/workspace-booking-ws2";
import { getWorkspacePlugin as getDenaliPlugin } from "@app-cloud/workspace-denali";
import { resolveBookingOpsCapability } from "@app-cloud/workspace-sdk";

import { resolveBookingOpsCapabilityForHub } from "../src/features/bookings/booking-ops-panels";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("thin-shell-booking-ops-capability — Phase 4bf", () => {
  it("TS-4BF-01 denali + booking-ws2 publish capabilities.bookingOps.resolveManifest", () => {
    const denali = resolveBookingOpsCapability(getDenaliPlugin());
    const ws2 = resolveBookingOpsCapability(getBookingWs2Plugin());
    assert.ok(denali);
    assert.ok(ws2);
    assert.equal(typeof denali.resolveManifest, "function");
    assert.equal(typeof ws2.resolveManifest, "function");
    assert.equal(denali.resolveManifest(null).id, "denali_registration_ops");
    assert.equal(ws2.resolveManifest(null).id, "booking_ws2_registration_ops");
    assert.equal(denali.resolveManifest(null).actions.bulkApprove.maxBatch, 25);
    assert.equal(ws2.resolveManifest(null).actions.bulkApprove.maxBatch, 10);
    assert.equal(denali.resolveManifest(null).actions.reject.requiresReason, false);
    assert.equal(ws2.resolveManifest(null).actions.reject.requiresReason, true);
    assert.ok(denali.resolveManifest(null).views.includes("tour_board"));
    assert.equal(ws2.resolveManifest(null).views.includes("tour_board"), false);
  });

  it("TS-4BF-02 booking-ops binder deleted; hub resolves via capability", async () => {
    assert.equal(
      existsSync(resolve(WEB_ROOT, "src/bootstrap/workspace-booking-ops-bindings.generated.ts")),
      false
    );
    const panels = readFileSync(
      resolve(WEB_ROOT, "src/features/bookings/booking-ops-panels.ts"),
      "utf8"
    );
    assert.match(panels, /resolveBookingOpsCapability/);
    assert.match(panels, /loadBootstrapWorkspacePlugin/);
    assert.doesNotMatch(panels, /workspace-booking-ops-bindings/);
    assert.doesNotMatch(panels, /@app-cloud\/workspace-denali/);
    assert.doesNotMatch(panels, /@app-cloud\/workspace-booking-ws2/);

    const hub = await resolveBookingOpsCapabilityForHub(null, "denali");
    assert.ok(hub);
    assert.equal(hub.id, "denali_registration_ops");
    assert.equal(await resolveBookingOpsCapabilityForHub(null, "urban"), null);
    assert.equal(await resolveBookingOpsCapabilityForHub(null, ""), null);
  });
});
