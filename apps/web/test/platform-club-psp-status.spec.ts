/**
 * P5-D-N-008 — Super Admin PSP status panel (UI-03)
 * @see docs/phase-18/platform-integrations-plane.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  clubPspSurfaceStatusLabel,
  resolveClubPspSurfaceStatus,
} from "../src/platform/integrations-plane-status.ts";

describe("platform-club-psp-status (P5-D UI-03)", () => {
  it("UI-03 component exposes PSP checklist test ids", () => {
    const source = readFileSync(
      new URL("../src/platform/club-psp-status.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-testid="platform-club-psp-status"/);
    assert.match(source, /data-psp-plane-checklist/);
    assert.match(source, /data-psp-check="webhook"/);
    assert.match(source, /data-psp-check="gateway-activation"/);
    assert.match(source, /Gateway activation:/);
  });

  it("UI-03 workspace tab renders ClubPspStatus with integrations plane", () => {
    const tab = readFileSync(
      new URL("../src/platform/club-detail/tab-workspace-definition.tsx", import.meta.url),
      "utf8"
    );
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(tab, /ClubPspStatus/);
    assert.match(tab, /integrationsPlane=\{integrationsPlane\}/);
    assert.match(client, /integrationsPlane=\{detail\.integrationsPlane\}/);
  });

  it("UI-03b offline receipt clubs surface offline status", () => {
    assert.equal(
      resolveClubPspSurfaceStatus({
        workspaceType: "starter",
        paymentMode: "offline_receipt",
        gatewayProvider: null,
        integrationsPlane: {
          zibalConfigured: true,
          stripeConfigured: true,
          webhookConfigured: true,
          gatewayActivationEnabled: true,
        },
      }),
      "offline_receipt"
    );
    assert.match(clubPspSurfaceStatusLabel("offline_receipt"), /Offline receipt/i);
  });

  it("UI-03c gateway mode blocked until P5-D exit when GU-02 active", () => {
    assert.equal(
      resolveClubPspSurfaceStatus({
        workspaceType: "starter",
        paymentMode: "gateway",
        gatewayProvider: "zibal",
        integrationsPlane: {
          zibalConfigured: true,
          stripeConfigured: false,
          webhookConfigured: true,
          gatewayActivationEnabled: false,
        },
      }),
      "gateway_blocked"
    );
  });

  it("UI-03d server loader resolves integrations plane from env flags", () => {
    const resolver = readFileSync(
      new URL("../src/platform/resolve-integrations-plane-status.server.ts", import.meta.url),
      "utf8"
    );
    assert.match(resolver, /ZIBAL_MERCHANT/);
    assert.match(resolver, /STRIPE_SECRET_KEY/);
    assert.match(resolver, /PAYMENTS_WEBHOOK_SIGNING_SECRET/);
    assert.match(resolver, /P5_D_GATEWAY_ACTIVATION_ENABLED/);
  });
});
