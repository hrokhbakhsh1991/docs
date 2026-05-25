import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertLedgerJournalDoubleEntry } from "@repo/shared-contracts";
import { DenaliWorkspaceStrategy } from "./denali.workspace.strategy";
import { GeneralWorkspaceStrategy } from "./general.workspace.strategy";
import {
  isDenaliStrategyProfile,
  WorkspaceStrategyRegistry,
} from "./workspace.strategy.registry";
import { buildValidationRules } from "./workspace.strategy.builders";

describe("WorkspaceStrategyRegistry", () => {
  it("resolve(general) returns GeneralWorkspaceStrategy with classic wizard", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("general");
    assert.ok(strategy instanceof GeneralWorkspaceStrategy);
    assert.equal(strategy.profile, "general");
    assert.equal(strategy.getWizardConfig().wizardMode, "classic");
    assert.equal(strategy.getPublishPolicy().publishGeolocationCheck, null);
  });

  it("resolve(denali_pilot) returns DenaliWorkspaceStrategy with denali wizard and geo check", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("denali_pilot");
    assert.ok(strategy instanceof DenaliWorkspaceStrategy);
    assert.equal(strategy.getWizardConfig().wizardMode, "denali");
    assert.equal(typeof strategy.getPublishPolicy().publishGeolocationCheck, "function");
    const rules = strategy.getValidationRules();
    assert.equal(rules.appliesWorkspaceTripDetailsValidation, true);
    assert.equal(rules.workspaceTripDetailsValidationPhase, "before_canonical");
  });

  it("resolve(urban_event) uses Denali strategy without publish geolocation check", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("urban_event");
    assert.ok(strategy instanceof DenaliWorkspaceStrategy);
    assert.equal(strategy.getPublishPolicy().publishGeolocationCheck, null);
    const rules = strategy.getValidationRules();
    assert.equal(rules.appliesWorkspaceTripDetailsValidation, false);
    assert.equal(rules.workspaceTripDetailsValidationPhase, "never");
  });

  it("resolve(nature_trip) uses General strategy with Arctic workspace validation", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("nature_trip");
    assert.ok(strategy instanceof GeneralWorkspaceStrategy);
    const rules = strategy.getValidationRules();
    assert.equal(typeof rules.workspaceValidation?.checkCapacity, "function");
    assert.equal(rules.workspaceValidation?.checkTripDetails(null), null);
  });

  it("denali_pilot field strip enables single-day logistics cleanup", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("denali_pilot");
    assert.equal(strategy.getFieldStripRules().appliesDenaliSingleDayLogisticsStrip, true);
  });

  it("urban_event field strip does not enable denali single-day logistics cleanup", () => {
    const strategy = WorkspaceStrategyRegistry.resolve("urban_event");
    assert.equal(strategy.getFieldStripRules().appliesDenaliSingleDayLogisticsStrip, false);
  });

  it("isDenaliStrategyProfile identifies denali profiles only", () => {
    assert.equal(isDenaliStrategyProfile("denali_pilot"), true);
    assert.equal(isDenaliStrategyProfile("urban_event"), true);
    assert.equal(isDenaliStrategyProfile("general"), false);
  });

  it("all strategies require draft before publish", () => {
    for (const profile of [
      "general",
      "denali_pilot",
      "urban_event",
      "mountain_outdoor",
    ] as const) {
      const strategy = WorkspaceStrategyRegistry.resolve(profile);
      assert.equal(strategy.getPublishPolicy().requiresDraftBeforePublish, true);
    }
  });

  it("assertLedgerJournalDoubleEntry throws on imbalanced entries (sanity import)", () => {
    assert.throws(
      () =>
        assertLedgerJournalDoubleEntry(
          [
            {
              journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              side: "debit",
              amountMinor: "100",
              currency: "USD",
            },
            {
              journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              side: "credit",
              amountMinor: "99",
              currency: "USD",
            },
          ],
          {
            journalId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          },
        ),
      /LEDGER_DOUBLE_ENTRY_INVALID/,
    );
  });

  it("buildValidationRules returns descriptor-backed inactive groups", () => {
    const rules = buildValidationRules("urban_event");
    assert.ok(rules.inactiveFieldGroups.length > 0);
  });
});
