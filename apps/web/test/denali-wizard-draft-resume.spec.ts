/**
 * Phase 11.5 — Denali wizard draft envelope merge/resume (WEB-P11-5-01)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali";

import { mergeDenaliWizardDraftEnvelope } from "../src/draft/denali-wizard-draft-merge";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";

describe("denali-wizard-draft-resume.spec.ts — Phase 11.5", () => {
  it("WEB-P11-5-01 merge keeps local step and merges form data", () => {
    const local = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Local", featured: "true" } } },
      { currentStepIndex: 2, wizardSessionId: "local-session" }
    );
    const server = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Server" }, details: { summary: "Remote" } } },
      { currentStepIndex: 0, wizardSessionId: "server-session" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.meta.currentStepIndex, 2);
    assert.equal(merged.meta.wizardSessionId, "local-session");
    assert.equal(merged.form.data.basics?.title, "Local");
    assert.equal(merged.form.data.details?.summary, "Remote");
  });

  it("WEB-P11-5-02 step index round-trips in envelope meta", () => {
    const envelope = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
      currentStepIndex: 4,
      wizardSessionId: "abc",
    });
    assert.equal(envelope.meta.currentStepIndex, 4);
  });

  it("WEB-P11-5-03 freshStart merge keeps local template over stale server", () => {
    const local = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Template seed" } } },
      { currentStepIndex: 0, wizardSessionId: "local-session", freshStart: true }
    );
    const server = denaliPrepareDraftEnvelope(
      {
        data: {
          basics: { title: "Stale server" },
          details: { summary: "Old summary" },
        },
      },
      { currentStepIndex: 4, wizardSessionId: "server-session" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.meta.currentStepIndex, 0);
    assert.equal(merged.meta.wizardSessionId, "local-session");
    assert.equal(merged.meta.freshStart, true);
    assert.equal(merged.form.data.basics?.title, "Template seed");
    assert.equal(merged.form.data.details?.summary, undefined);
  });

  it("WEB-P11-5-04 level-2 merge preserves server siblings under shared object root", () => {
    const local = denaliPrepareDraftEnvelope(
      {
        data: {
          program: {
            itinerary: [{ dayNumber: 1 }],
          },
        },
      },
      { currentStepIndex: 1, wizardSessionId: "local" }
    );
    const server = denaliPrepareDraftEnvelope(
      {
        data: {
          program: {
            itinerary: [{ dayNumber: 1 }, { dayNumber: 2 }],
            difficultyLevel: "5",
          },
        },
      },
      { currentStepIndex: 2, wizardSessionId: "server" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.form.data.program?.difficultyLevel, "5");
    assert.deepEqual(merged.form.data.program?.itinerary, [{ dayNumber: 1 }]);
  });

  it("WEB-P11-5-05 deletedRoots blocks server root resurrection", () => {
    const local = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Local" } } },
      { currentStepIndex: 2, wizardSessionId: "local", deletedRoots: ["details"] }
    );
    const server = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Server" }, details: { summary: "Remote" } } },
      { currentStepIndex: 0, wizardSessionId: "server" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.form.data.details?.summary, undefined);
    assert.deepEqual(merged.meta.deletedRoots, ["details"]);
  });

  it("WEB-P11-HERMETIC-03 merge output has no resurrected tombstone keys in form.data", () => {
    const local = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Local" } } },
      { currentStepIndex: 2, wizardSessionId: "local", deletedRoots: ["details"] }
    );
    const server = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Server" }, details: { summary: "Remote" } } },
      { currentStepIndex: 0, wizardSessionId: "server" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    const deleted = merged.meta.deletedRoots ?? [];
    const formKeys = Object.keys(merged.form.data as Record<string, unknown>);
    for (const root of deleted) {
      assert.equal(formKeys.includes(root), false, `tombstone ${root} must not appear in merged form.data`);
    }
  });
});
