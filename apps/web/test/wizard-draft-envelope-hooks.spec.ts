import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "@app-tour/workspace-denali/draft";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import {
  createWizardAssetSessionId,
  normalizeWizardRemoteEnvelope,
  prepareWizardDraftEnvelope,
} from "../src/wizard/wizard-draft-envelope-hooks";

describe("wizard-draft-envelope-hooks.spec.ts (P13-5)", () => {
  it("P13-5-01 createWizardAssetSessionId delegates to wizardHost.media", () => {
    const plugin = getDenaliWorkspacePlugin();
    assert.equal(typeof plugin.wizardHost?.media?.createAssetSessionId, "function");
    const viaHook = createWizardAssetSessionId(plugin, () => "fallback");
    assert.match(viaHook, /^[0-9a-f-]{36}$/i);
    assert.notEqual(viaHook, "fallback");

    const stubPlugin = { wizardHost: {} } as ReturnType<typeof getDenaliWorkspacePlugin>;
    assert.equal(createWizardAssetSessionId(stubPlugin, () => "fallback"), "fallback");
  });

  it("P13-5-02 prepareWizardDraftEnvelope matches package binding", () => {
    const plugin = getDenaliWorkspacePlugin();
    const form = emptyTourWizardDraft();
    const meta = { currentStepIndex: 1, wizardSessionId: "sess-1" };
    assert.deepEqual(
      prepareWizardDraftEnvelope(plugin, form, meta, denaliPrepareDraftEnvelope),
      denaliPrepareDraftEnvelope(form, meta)
    );
  });

  it("P13-5-03 normalizeWizardRemoteEnvelope strips deletedRoots", () => {
    const plugin = getDenaliWorkspacePlugin();
    const envelope = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
      currentStepIndex: 0,
      deletedRoots: ["pricing"],
    });
    const normalized = normalizeWizardRemoteEnvelope(
      plugin,
      {
        ...envelope,
        meta: { ...envelope.meta, deletedRoots: ["pricing"] },
      },
      (remote) => denaliHydrateDraftEnvelope(remote, remote.form, remote.meta)
    );
    assert.equal("deletedRoots" in normalized.meta, false);
  });
});
