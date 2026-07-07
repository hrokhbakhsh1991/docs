/**
 * P5-C-N-006 — Super Admin commerce badge (UI-02)
 * @see docs/phase-18/platform-workspace-commerce.mdoc
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-club-commerce-badge (P5-C UI-02)", () => {
  it("UI-02 badge component hides gateway UI for denali workspace type", () => {
    const source = readFileSync(
      new URL("../src/platform/club-commerce-badge.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-testid="platform-club-commerce-badge"/);
    assert.match(source, /data-commerce-gateway-ui=\{gatewayUi\}/);
    assert.match(source, /shouldShowClubCommerceGatewayUi/);
    assert.match(source, /data-commerce-gateway-hidden/);
    assert.match(source, /offline receipt review only/i);
  });

  it("UI-02 workspace tab renders commerce badge with workspace type", () => {
    const tab = readFileSync(
      new URL("../src/platform/club-detail/tab-workspace-definition.tsx", import.meta.url),
      "utf8"
    );
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(tab, /ClubCommerceBadge/);
    assert.match(tab, /workspaceType=\{workspaceType\}/);
    assert.match(client, /workspaceType=\{detail\.tenant\.workspaceType\}/);
  });

  it("UI-02b non-denali badge exposes gateway provider label", () => {
    const source = readFileSync(
      new URL("../src/platform/club-commerce-badge.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-commerce-gateway-provider/);
    assert.match(source, /resolvedMode === "gateway"/);
  });

  it("UI-02c workspace tab passes resolved workspaceCommerce to badge", () => {
    const tab = readFileSync(
      new URL("../src/platform/club-detail/tab-workspace-definition.tsx", import.meta.url),
      "utf8"
    );
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    const types = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail.types.ts", import.meta.url),
      "utf8"
    );
    assert.match(tab, /workspaceCommerce:/);
    assert.match(tab, /paymentMode=\{workspaceCommerce\.paymentMode\}/);
    assert.match(tab, /gatewayProvider=\{workspaceCommerce\.gatewayProvider\}/);
    assert.match(client, /workspaceCommerce=\{detail\.workspaceCommerce\}/);
    assert.match(types, /workspaceCommerce:/);
  });
});
