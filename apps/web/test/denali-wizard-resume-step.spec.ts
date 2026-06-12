/**
 * Denali wizard draft resume step resolution
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali";

import {
  hasNonEmptyCanonicalValue,
  readDenaliDraftFieldValue,
  resolveDenaliWizardResumeStepIndex,
} from "../src/draft/denali-wizard-resume-step";
import { mergeDenaliWizardDraftEnvelope } from "../src/draft/denali-wizard-draft-merge";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";

const TEMPLATE_STEPS = [
  {
    stepId: "denali_basic",
    label: "Basic",
    enabled: true,
    fields: [{ canonicalPath: "title" }, { canonicalPath: "category" }],
  },
  {
    stepId: "denali_program",
    label: "Program",
    enabled: true,
    fields: [{ canonicalPath: "program.difficultyLevel" }],
  },
  {
    stepId: "denali_logistics",
    label: "Logistics",
    enabled: true,
    fields: [{ canonicalPath: "transport.mode" }],
  },
] as const;

describe("denali-wizard-resume-step.spec.ts", () => {
  it("WEB-RESUME-01 merge prefers server step when local resume index is still 0", () => {
    const local = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
      currentStepIndex: 0,
      wizardSessionId: "local",
    });
    const server = denaliPrepareDraftEnvelope(
      { data: { title: "Saved tour" } },
      { currentStepIndex: 3, wizardSessionId: "server" }
    );
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.meta.currentStepIndex, 3);
  });

  it("WEB-RESUME-02 merge keeps active local step during edit conflicts", () => {
    const local = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
      currentStepIndex: 4,
      wizardSessionId: "local",
    });
    const server = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
      currentStepIndex: 2,
      wizardSessionId: "server",
    });
    const merged = mergeDenaliWizardDraftEnvelope(local, server);
    assert.equal(merged.meta.currentStepIndex, 4);
  });

  it("WEB-RESUME-03 infers furthest template step with entered data when saved index is 0", () => {
    const draft = { data: { title: "My tour", program: { difficultyLevel: 6 } } };
    assert.equal(resolveDenaliWizardResumeStepIndex(draft, TEMPLATE_STEPS, 0), 1);
    assert.equal(resolveDenaliWizardResumeStepIndex(draft, TEMPLATE_STEPS, 2), 2);
  });

  it("WEB-RESUME-05 reads legacy nested form paths for resume inference", () => {
    const draft = {
      data: {
        basicInfo: { title: "Legacy title" },
        programNature: { difficultyLevel: 7 },
      },
    };
    assert.equal(readDenaliDraftFieldValue(draft, "title"), "Legacy title");
    assert.equal(resolveDenaliWizardResumeStepIndex(draft, TEMPLATE_STEPS, 0), 1);
  });

  it("WEB-RESUME-04 detects non-empty canonical values", () => {
    assert.equal(hasNonEmptyCanonicalValue(""), false);
    assert.equal(hasNonEmptyCanonicalValue("x"), true);
    assert.equal(hasNonEmptyCanonicalValue([{ name: "A" }]), true);
    assert.equal(hasNonEmptyCanonicalValue([{}]), false);
  });
});
