/**
 * Track C — DRAFT_UNIFICATION_V3 rollout + Denali conflict wiring
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  createOperatorDraftOnPushSuccess,
  resolveOperatorDraftConflictStrategy,
} from "../src/draft/draft-unification-v3-options";
import { resolveDenaliDraftMerge } from "@app-tour/workspace-denali/host/draft/wizard-draft-unification-surface";
import { resolveDraftUnificationV3Mode } from "../src/draft/draft-unification-v3";
import { logDenaliTombstoneShadowMismatch } from "@app-tour/workspace-denali/host/draft/wizard-draft-unification-surface";
import { mergeDenaliWizardDraftEnvelope } from "@app-tour/workspace-denali/host/draft/wizard-draft-unification-surface";

const ENV_KEYS = ["DRAFT_UNIFICATION_V3", "NEXT_PUBLIC_DRAFT_UNIFICATION_V3"] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

describe("draft-unification-v3.spec.ts — Track C", () => {
  afterEach(() => {
    clearEnv();
  });

  it("WEB-P11-C-01 resolveDraftUnificationV3Mode defaults to off", () => {
    clearEnv();
    assert.equal(resolveDraftUnificationV3Mode(), "off");
  });

  it("WEB-P11-C-02 NEXT_PUBLIC_DRAFT_UNIFICATION_V3 wins over server env", () => {
    process.env.DRAFT_UNIFICATION_V3 = "shadow";
    process.env.NEXT_PUBLIC_DRAFT_UNIFICATION_V3 = "on";
    assert.equal(resolveDraftUnificationV3Mode(), "on");
  });

  it("WEB-P11-C-03 conflict strategy is SERVER_WINS only when mode is on", () => {
    assert.equal(resolveOperatorDraftConflictStrategy("off"), "REFETCH_REAPPLY");
    assert.equal(resolveOperatorDraftConflictStrategy("shadow"), "REFETCH_REAPPLY");
    assert.equal(resolveOperatorDraftConflictStrategy("on"), "SERVER_WINS");
  });

  it("WEB-P11-C-04 merge function omitted when mode is on", () => {
    assert.equal(typeof resolveDenaliDraftMerge("off"), "function");
    assert.equal(typeof resolveDenaliDraftMerge("shadow"), "function");
    assert.equal(resolveDenaliDraftMerge("on"), undefined);
  });

  it("WEB-P11-C-05 mergeDenaliWizardDraftEnvelope honors server tombstones but omits client meta (INV-2)", () => {
    const local = {
      form: { data: { basics: { title: "Local" } } },
      meta: { currentStepIndex: 2, deletedRoots: ["photos"] as const },
    };
    const server = {
      form: { data: { basics: { title: "Server" }, details: { summary: "Remote" } } },
      meta: { currentStepIndex: 0, deletedRoots: ["details"] as const },
    };
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.meta.deletedRoots, undefined);
    assert.equal(merged.form.data.details?.summary, undefined);
  });

  it("WEB-P11-C-06 shadow tombstone compare logs only in shadow mode", async () => {
    const baseline = {
      form: { data: { photos: [{ id: "p1" }] } },
      meta: { currentStepIndex: 0 },
    };
    const pushed = {
      form: { data: {} },
      meta: { currentStepIndex: 0 },
    };
    const server = {
      form: { data: {} },
      meta: { currentStepIndex: 0 },
    };

    const warnings: unknown[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    try {
      logDenaliTombstoneShadowMismatch("off", baseline, pushed, server);
      assert.equal(warnings.length, 0);

      logDenaliTombstoneShadowMismatch("shadow", baseline, pushed, server);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      assert.equal(warnings.length, 1);
      assert.match(String(warnings[0]?.[0] ?? ""), /tombstone shadow mismatch/);

      warnings.length = 0;
      const wrapPayload = (envelope: typeof baseline) => ({
        data: envelope,
        version: 1,
        schemaVersion: 1,
        lastModified: 100,
      });
      createOperatorDraftOnPushSuccess("shadow")(wrapPayload(pushed), wrapPayload(server), baseline);
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
      assert.equal(warnings.length, 1);
    } finally {
      console.warn = originalWarn;
    }
  });
});
