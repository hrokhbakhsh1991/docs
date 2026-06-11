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
});
