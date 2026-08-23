/**
 * Finance B2.3 — capability matrix certification.
 *
 * `supported=true` is product enablement only. Workspaces must not claim a money-path
 * capability they do not implement (codegen + runtime binding cross-check).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FinanceWs5TourCreatedFinanceReactionAdapter } from "@app-tour/workspace-finance-ws5";
import { isFinanceDependencyBindingRegistered } from "./workspace-finance-dependency-bindings.generated.ts";
import { WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS } from "./workspace-finance-event-reaction-bindings.generated.ts";
import { isFinanceChartOfAccountsBindingRegistered } from "./workspace-finance-chart-of-accounts-bindings.generated.ts";
import {
  financeWorkspaceEventReactionCapability,
  financeWorkspaceHasCapability,
  getFinanceWorkspaceCapabilities,
  listFinanceCapableWorkspaceTypes,
  WORKSPACE_FINANCE_CAPABILITIES,
} from "./workspace-finance-capabilities.generated.ts";
import { isFinanceSupportedWorkspace } from "./workspace-finance-bindings.generated.ts";
import { resolveFinanceWorkspaceDependencies } from "./finance-dependency-registry.ts";
import { resolveWorkspaceFinanceEventReaction } from "./finance-event-reaction-registry.ts";
import { resolveFinanceChartOfAccounts } from "./finance-chart-of-accounts-registry.ts";

const CAPTURE_INPUT = {
  tenantId: "00000000-0000-4000-8000-000000000014",
  paymentId: "00000000-0000-4000-8000-000000000601",
  registrationId: "00000000-0000-4000-8000-000000000602",
  amountMinor: "2500",
  currency: "USD",
  capturedAtIso: "2026-07-19T15:00:00.000Z",
};

describe("finance supported workspace capability matrix (B2.3)", () => {
  it("supported set includes production workspaces plus the Alpine PROD-4 fixture", () => {
    assert.deepEqual(listFinanceCapableWorkspaceTypes(), ["alpine", "denali", "finance-ws5"]);
    assert.equal(isFinanceSupportedWorkspace("alpine"), true);
    assert.equal(isFinanceSupportedWorkspace("denali"), true);
    assert.equal(isFinanceSupportedWorkspace("finance-ws5"), true);

    const alpine = getFinanceWorkspaceCapabilities("alpine");
    const denali = getFinanceWorkspaceCapabilities("denali");
    const ws5 = getFinanceWorkspaceCapabilities("finance-ws5");
    assert.ok(alpine);
    assert.ok(denali);
    assert.ok(ws5);

    assert.deepEqual(alpine, {
      supported: true,
      ledgerCapture: true,
      eventReactions: "ack-only",
      ops: true,
      caseMeaning: false,
    });
    assert.deepEqual(denali, {
      supported: true,
      ledgerCapture: true,
      eventReactions: "durable-outbox",
      ops: true,
      caseMeaning: true,
    });
    assert.deepEqual(ws5, {
      supported: true,
      ledgerCapture: true,
      eventReactions: "ack-only",
      ops: true,
      caseMeaning: false,
    });
    assert.notEqual(
      denali.eventReactions,
      ws5.eventReactions,
      "supported must not imply identical TourCreated money semantics"
    );
  });

  it("fails closed: unsupported / demoted workspaces claim no capabilities", () => {
    for (const wt of ["finance-ws2", "finance-ws3", "finance-ws4", "finance-ws6", "booking-ws2"]) {
      assert.equal(getFinanceWorkspaceCapabilities(wt), null);
      assert.equal(financeWorkspaceHasCapability(wt, "ledgerCapture"), false);
      assert.equal(financeWorkspaceHasCapability(wt, "ops"), false);
      assert.equal(financeWorkspaceEventReactionCapability(wt), null);
      assert.equal(isFinanceSupportedWorkspace(wt), false);
    }
  });

  it("every claimed capability has a matching runtime binding (no hollow claims)", async () => {
    for (const workspaceType of listFinanceCapableWorkspaceTypes()) {
      const caps =
        WORKSPACE_FINANCE_CAPABILITIES[
          workspaceType as keyof typeof WORKSPACE_FINANCE_CAPABILITIES
        ];
      assert.equal(isFinanceSupportedWorkspace(workspaceType), true);

      if (caps.ledgerCapture) {
        assert.equal(
          isFinanceDependencyBindingRegistered(workspaceType),
          true,
          `${workspaceType} claims ledgerCapture but has no dependency binding`
        );
        assert.equal(
          isFinanceChartOfAccountsBindingRegistered(workspaceType),
          true,
          `${workspaceType} claims ledgerCapture but has no CoA binding`
        );
        const deps = await resolveFinanceWorkspaceDependencies(workspaceType);
        const plan = deps.ledgerPolicy.buildPaymentCaptureJournal(CAPTURE_INPUT);
        assert.ok(plan.journalId.length > 0);
        assert.ok(plan.lines.length >= 2, `${workspaceType} ledgerCapture must post double-entry`);
        assert.ok(plan.domainEventId.includes("ledger-capture"));
        const coa = await resolveFinanceChartOfAccounts(workspaceType);
        assert.ok(Object.keys(coa).length > 0);
      }

      if (caps.ops) {
        assert.equal(financeWorkspaceHasCapability(workspaceType, "ops"), true);
      }

      const reactionKey = workspaceType.trim().toLowerCase();
      const binding =
        WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS[
          reactionKey as keyof typeof WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS
        ];
      assert.ok(binding, `${workspaceType} missing event reaction binding`);

      if (caps.eventReactions === "durable-outbox") {
        assert.equal(
          binding.requiresHostIo,
          true,
          `${workspaceType} claims durable-outbox but requiresHostIo=false`
        );
      } else if (caps.eventReactions === "ack-only") {
        assert.equal(
          binding.requiresHostIo,
          false,
          `${workspaceType} claims ack-only but requiresHostIo=true (would imply durable money path)`
        );
      } else {
        assert.fail(`${workspaceType}: supported workspaces must not claim eventReactions=none`);
      }
    }
  });

  it("behavioral: ack-only acknowledges without durable outbox drain; durable-outbox requires host IO", async () => {
    assert.equal(financeWorkspaceEventReactionCapability("finance-ws5"), "ack-only");
    assert.equal(financeWorkspaceEventReactionCapability("denali"), "durable-outbox");

    const ws5 = await resolveWorkspaceFinanceEventReaction("finance-ws5");
    assert.ok(ws5 instanceof FinanceWs5TourCreatedFinanceReactionAdapter);
    const batch = await ws5.consumePendingForTenant("00000000-0000-4000-8000-000000000014");
    assert.deepEqual(batch, { handled: 0, skipped: 0 });

    const handled = await ws5.reactToPublishedRow({
      tenantId: "00000000-0000-4000-8000-000000000014",
      domainEventId: "b23-ack-1",
      eventType: "TourCreated",
      aggregateType: "tour",
      aggregateId: "00000000-0000-4000-8000-000000000088",
      payload: {},
    });
    assert.equal(handled, true);
    assert.ok(ws5.handledDomainEventIds.includes("b23-ack-1"));

    const denaliBinding = WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS.denali;
    assert.equal(denaliBinding.requiresHostIo, true);
    // Durable path is constructor(hostIo) — create without hostIo must be unavailable on the binding type.
    assert.equal(typeof denaliBinding.create, "function");
    assert.equal(denaliBinding.create.length, 1, "durable-outbox create(hostIo) arity");

    const ws5Binding = WORKSPACE_FINANCE_EVENT_REACTION_BINDINGS["finance-ws5"];
    assert.equal(ws5Binding.requiresHostIo, false);
    assert.equal(ws5Binding.create.length, 0, "ack-only create() arity");
  });
});
