import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  denaliEditTourDraftKey,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
} from "../src/draft/denali-wizard-draft-binding";

describe("denali-wizard-draft-binding.spec.ts — Phase 11.5", () => {
  it("WEB-P11-5-01 prepare clones form and meta", () => {
    const form = { data: { basics: { title: "Alpine" } } };
    const envelope = denaliPrepareDraftEnvelope(form, {
      currentStepIndex: 2,
      wizardSessionId: "session-1",
    });
    assert.notEqual(envelope.form, form);
    assert.deepEqual(envelope.form, form);
    assert.equal(envelope.meta.currentStepIndex, 2);
    assert.equal(envelope.meta.wizardSessionId, "session-1");
  });

  it("WEB-P11-5-02 hydrate uses remote step index", () => {
    const remote = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Remote" } } },
      { currentStepIndex: 3, wizardSessionId: "remote" }
    );
    const hydrated = denaliHydrateDraftEnvelope(
      remote,
      { data: { basics: { title: "Fallback" } } },
      { currentStepIndex: 0, wizardSessionId: "local" }
    );
    assert.equal(hydrated.meta.currentStepIndex, 3);
    assert.equal(hydrated.meta.wizardSessionId, "remote");
    assert.equal(hydrated.form.data.basics.title, "Remote");
  });

  it("WEB-P11-5-03 hydrate null falls back to template form", () => {
    const hydrated = denaliHydrateDraftEnvelope(
      null,
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 1, wizardSessionId: "ws-1" }
    );
    assert.equal(hydrated.meta.currentStepIndex, 1);
    assert.equal(hydrated.meta.wizardSessionId, "ws-1");
    assert.equal(hydrated.form.data.basics.title, "Seed");
  });

  it("WEB-P11-5-04 edit draft key is scoped per tour id", () => {
    assert.equal(denaliEditTourDraftKey("abc-123"), "denali-edit:abc-123");
    assert.equal(denaliEditTourDraftKey("  "), "denali-edit:unknown");
  });

  it("WEB-P11-5-05 prepare preserves freshStart meta flag", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 0, freshStart: true }
    );
    assert.equal(envelope.meta.freshStart, true);
  });

  it("WEB-P11-5-06 prepare and hydrate preserve deletedRoots meta", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 1, deletedRoots: ["details", "program"] }
    );
    assert.deepEqual(envelope.meta.deletedRoots, ["details", "program"]);
    const hydrated = denaliHydrateDraftEnvelope(
      envelope,
      { data: { basics: { title: "Fallback" } } },
      { currentStepIndex: 0 }
    );
    assert.deepEqual(hydrated.meta.deletedRoots, ["details", "program"]);
  });
});
