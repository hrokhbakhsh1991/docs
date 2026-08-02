/**
 * WEB-WIZ-011 — wizard host reads legacy nested draft paths for display.
 * Phase 4am: denali path via capabilities.draftShell (unification binder deleted).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getWorkspacePlugin as getDenaliPlugin } from "@app-tour/workspace-denali";

import {
  readWizardDraftFieldDisplayString,
  readWizardDraftFieldValue,
} from "../src/tours/read-wizard-draft-field-value";
import type { TourWizardDraft } from "../src/tours/tour-wizard-draft";

describe("read-wizard-draft-field-value", () => {
  it("WEB-WIZ-011-01 denali reads legacy nested title", () => {
    const denali = getDenaliPlugin();
    const draft = {
      data: {
        basicInfo: { title: "Legacy title" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title", denali), "Legacy title");
    assert.equal(
      readWizardDraftFieldDisplayString(draft, "text", "title", denali),
      "Legacy title"
    );
  });

  it("WEB-WIZ-011-02 starter bridges basics.title ↔ title (shell aliases)", () => {
    const draft = {
      data: {
        basics: { title: "Starter basics title" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title"), "Starter basics title");
    assert.equal(
      readWizardDraftFieldDisplayString(draft, "text", "title"),
      "Starter basics title"
    );
  });

  it("WEB-WIZ-011-03 canonical path wins over legacy alias", () => {
    const denali = getDenaliPlugin();
    const draft = {
      data: {
        title: "Canonical",
        basicInfo: { title: "Legacy" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title", denali), "Canonical");
  });
});
