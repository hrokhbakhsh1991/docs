import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clearWorkspaceMemberPortalRenderersForTests,
  getWorkspaceMemberPortalRenderer,
  registerWorkspaceMemberPortalRenderers,
  resolveFinanceNavCapability,
  resolveMemberPortalModuleByRoutePath,
  resolveMemberPortalModules,
  resolveOperatorShellNavCapability,
} from "@app-tour/workspace-sdk";

import { getBookingWorkspaceCapabilities } from "../../../../apps/api/src/bookings/workspace-booking-capabilities.generated";
import {
  listDeliveryReferenceDisplayFieldIds,
  listTourPublishedExposureRemapTargets,
  requiresTourPublishedPolicyDriftCheck,
  supportsDeliveryReferenceDisplay,
  supportsTourPublishedExposureRemap,
} from "../../../../apps/api/src/integrations/platform/workspace-integration-capabilities.generated";
import { enrichSettingsModuleList } from "../../../../apps/api/src/settings/workspace-settings-enrichers.generated";
import {
  financeWorkspaceEventReactionCapability,
  financeWorkspaceHasCapability,
  getFinanceWorkspaceCapabilities,
} from "../../../../apps/api/src/workspace-finance/workspace-finance-capabilities.generated";
import {
  isFinanceObligationBindingRegistered,
  listFinanceObligationWorkspaceTypes,
} from "../../../../apps/api/src/workspace-finance/workspace-finance-obligation-bindings.generated";
import { AlpineLedgerPolicyAdapter } from "../src/finance/ledger-policy.adapter";
import { getWorkspacePlugin } from "../src/plugin";

const plugin = getWorkspacePlugin();

describe("synthetic Alpine drop-in fixture", () => {
  it("declares operator nav through package-local capability data", () => {
    const nav = resolveOperatorShellNavCapability(plugin);
    assert.deepEqual(nav?.links, [{ href: "/alpine-field-notes", labelKey: "alpineFieldNotes" }]);
  });

  it("declares member portal renderer without portal host branching", () => {
    clearWorkspaceMemberPortalRenderersForTests();
    registerWorkspaceMemberPortalRenderers(plugin.id, plugin.capabilities?.memberPortalRenderers);
    const renderer = getWorkspaceMemberPortalRenderer("alpine", "alpine-notes");
    assert.equal(typeof renderer, "function");
    assert.deepEqual(renderer?.({ moduleId: "alpine-notes", routePath: "/me/alpine-notes" }), {
      kind: "alpine-member-renderer",
      moduleId: "alpine-notes",
      routePath: "/me/alpine-notes",
    });
  });

  it("resolves generated member portal contract for Alpine", () => {
    const surface = resolveMemberPortalModules("alpine");
    assert.equal(surface.defaultPrimaryModuleId, "trips");
    assert.equal(resolveMemberPortalModuleByRoutePath("alpine", "/me/alpine-notes").id, "alpine-notes");
  });

  it("enables finance navigation but keeps Denali case meaning absent", () => {
    assert.equal(resolveFinanceNavCapability(plugin)?.supported, true);
    assert.equal(plugin.capabilities?.financeCaseMeaning, undefined);
  });

  it("uses Alpine-owned ledger accounts rather than Denali semantics", () => {
    const plan = new AlpineLedgerPolicyAdapter().buildPaymentCaptureJournal({
      tenantId: "tenant-alpine",
      paymentId: "pay-1",
      registrationId: "reg-1",
      amountMinor: "9900",
      currency: "CHF",
      capturedAtIso: "2026-08-23T00:00:00.000Z",
    });
    assert.equal(plan.lines[0]?.account, "alpine:gl:operator-cash-clearing");
    assert.equal(plan.lines[1]?.account, "alpine:booking:reg-1");
    assert.notEqual(plan.lines[0]?.account, "denali:gl:operator-cash-clearing");
  });

  it("registers finance as Alpine-owned without Denali obligation semantics", () => {
    assert.deepEqual(getFinanceWorkspaceCapabilities("alpine"), {
      supported: true,
      ledgerCapture: true,
      eventReactions: "ack-only",
      ops: true,
      caseMeaning: false,
    });
    assert.equal(financeWorkspaceHasCapability("alpine", "ops"), true);
    assert.equal(financeWorkspaceHasCapability("alpine", "caseMeaning"), false);
    assert.equal(financeWorkspaceEventReactionCapability("alpine"), "ack-only");
    assert.equal(isFinanceObligationBindingRegistered("alpine"), false);
    assert.deepEqual(listFinanceObligationWorkspaceTypes(), ["denali"]);
  });

  it("does not inherit Denali settings, delivery, or booking capability bindings", () => {
    const settings = [{ id: "theme-1", formProfile: "snow" }];
    assert.deepEqual(enrichSettingsModuleList("alpine", "tour_themes", settings), settings);
    assert.equal(requiresTourPublishedPolicyDriftCheck("alpine", "telegram"), false);
    assert.equal(supportsTourPublishedExposureRemap("alpine", "telegram"), false);
    assert.equal(supportsDeliveryReferenceDisplay("alpine", "telegram"), false);
    assert.deepEqual(listDeliveryReferenceDisplayFieldIds("alpine", "telegram"), []);
    assert.deepEqual(listTourPublishedExposureRemapTargets(), [
      { workspaceType: "denali", providerId: "telegram" },
    ]);
    assert.equal(getBookingWorkspaceCapabilities("alpine"), null);
  });
});
