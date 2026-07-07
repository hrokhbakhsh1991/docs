import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createDenaliWizardDraftSessionId,
  isDenaliWizardDraftSessionId,
} from "../src/photos/wizard-draft-session-id";
import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "../src/draft/denali-wizard-draft-binding";
import { getDenaliWorkspacePlugin } from "../src/denali.plugin";

describe("denali-wizard-host-hooks.spec.ts (P13-0)", () => {
  it("P13-0-01 exposes wizardHost.media with session helpers", () => {
    const plugin = getDenaliWorkspacePlugin();
    const media = plugin.wizardHost?.media;
    assert.ok(media);
    assert.equal(media.mediaRouteKey, "wizard-photos");
    const id = media.createAssetSessionId();
    assert.equal(media.isAssetSessionId(id), true);
    assert.equal(media.isAssetSessionId("not-uuid"), false);
  });

  it("P13-0-02 media hooks delegate to package session functions", () => {
    const plugin = getDenaliWorkspacePlugin();
    const media = plugin.wizardHost?.media;
    assert.ok(media);
    const directId = createDenaliWizardDraftSessionId();
    assert.equal(media.isAssetSessionId(directId), isDenaliWizardDraftSessionId(directId));
  });

  it("P13-0-03 resolveMatrixDimensionsFromDraft unchanged (regression)", () => {
    const plugin = getDenaliWorkspacePlugin();
    const dims = plugin.wizardHost?.resolveMatrixDimensionsFromDraft?.({ data: {} }, null);
    assert.deepEqual(dims, { category: "mountain", duration: "single_day" });
  });
});

describe("denali-wizard-host-hooks.spec.ts (P13-0b)", () => {
  it("P13-0b-01 prepareDraftEnvelope strips deletedRoots from meta", () => {
    const plugin = getDenaliWorkspacePlugin();
    const prepare = plugin.wizardHost?.prepareDraftEnvelope;
    assert.ok(prepare);
    const env = prepare(
      { data: { title: "x" } },
      { currentStepIndex: 2, deletedRoots: ["pricing"], wizardSessionId: "sess-1" }
    );
    assert.deepEqual(env.meta, { currentStepIndex: 2, wizardSessionId: "sess-1" });
    assert.equal("deletedRoots" in env.meta, false);
  });

  it("P13-0b-02 hydrateDraftEnvelope with null remote uses fallback", () => {
    const plugin = getDenaliWorkspacePlugin();
    const hydrate = plugin.wizardHost?.hydrateDraftEnvelope;
    assert.ok(hydrate);
    const fallbackForm = { data: {} };
    const env = hydrate({
      remote: null,
      fallbackForm,
      fallbackMeta: { currentStepIndex: 1, wizardSessionId: "w1" },
    });
    assert.deepEqual(env.form, fallbackForm);
    assert.deepEqual(env.meta, { currentStepIndex: 1, wizardSessionId: "w1" });
  });

  it("P13-0b-03 draft hooks delegate to package binding functions", () => {
    const plugin = getDenaliWorkspacePlugin();
    const form = { data: { a: 1 } };
    const meta = { currentStepIndex: 0, deletedRoots: ["gear"] as const };
    const viaHook = plugin.wizardHost?.prepareDraftEnvelope?.(form, meta);
    const direct = denaliPrepareDraftEnvelope(form, meta);
    assert.deepEqual(viaHook, direct);

    const remote = {
      form: { data: { b: 2 } },
      meta: { currentStepIndex: 3, deletedRoots: ["pricing"] as const },
    };
    const hydratedViaHook = plugin.wizardHost?.hydrateDraftEnvelope?.({
      remote,
      fallbackForm: form,
    });
    const hydratedDirect = denaliHydrateDraftEnvelope(remote, form);
    assert.deepEqual(hydratedViaHook, hydratedDirect);

    const normalizedViaHook = plugin.wizardHost?.normalizeRemoteEnvelope?.(remote);
    const normalizedDirect = denaliHydrateDraftEnvelope(remote, remote.form, remote.meta);
    assert.deepEqual(normalizedViaHook, normalizedDirect);
  });
});

describe("denali-wizard-host-hooks.spec.ts (P14-0b)", () => {
  it("P14-0b-01 normalizeWizardTemplateGate injects category and denali_pilot profile", () => {
    const plugin = getDenaliWorkspacePlugin();
    const normalize = plugin.wizardHost?.normalizeWizardTemplateGate;
    assert.equal(typeof normalize, "function");

    const result = normalize!({
      published: true,
      templateSteps: [
        {
          stepId: "denali_basic",
          enabled: true,
          fields: [{ canonicalPath: "title", required: true }],
        },
      ],
      allowedCanonicalPaths: ["title"],
      workspaceFormProfile: "",
      fieldRulesOverlay: {},
      seedLabel: "",
    });

    assert.equal(result.templateSteps[0]?.fields[0]?.canonicalPath, "category");
    assert.ok(result.allowedCanonicalPaths.includes("category"));
    assert.equal(result.workspaceFormProfile, "denali_pilot");
  });
});
