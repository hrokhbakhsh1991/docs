import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "../src/denali.plugin";
import { mergeDenaliWizardDraftEnvelope } from "../src/draft/merge-envelope";

describe("merge-envelope-hook.spec.ts (P14-2-T03)", () => {
  it("denali wizardHost.mergeDraftEnvelope delegates to package merge", () => {
    const plugin = getDenaliWorkspacePlugin();
    const merge = plugin.wizardHost?.mergeDraftEnvelope;
    assert.equal(typeof merge, "function");

    const local = {
      form: { data: { title: "Local" } },
      meta: { currentStepIndex: 1 },
    };
    const server = {
      form: { data: { title: "Server", program: { shortDescription: "Remote" } } },
      meta: { currentStepIndex: 0 },
    };
    const viaHook = merge!(local, server);
    const direct = mergeDenaliWizardDraftEnvelope(local, server);
    assert.deepEqual(viaHook, direct);
  });

  it("preserves local sourceRowVersion across conflict merge", () => {
    const merged = mergeDenaliWizardDraftEnvelope(
      {
        form: { data: { title: "Local" } },
        meta: { currentStepIndex: 1, sourceRowVersion: 4 },
      },
      {
        form: { data: { title: "Server" } },
        meta: { currentStepIndex: 0, sourceRowVersion: 2 },
      }
    );
    assert.equal(merged.meta.sourceRowVersion, 4);
  });
});
