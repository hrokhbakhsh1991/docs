/**
 * WEB-WIZ-011 — wizard host reads legacy nested draft paths for display.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { ensureWizardDraftUnificationSurface } from "../src/bootstrap/workspace-wizard-draft-unification-bindings.generated";
import {
  readWizardDraftFieldDisplayString,
  readWizardDraftFieldValue,
} from "../src/tours/read-wizard-draft-field-value";
import type { TourWizardDraft } from "../src/tours/tour-wizard-draft";

describe("read-wizard-draft-field-value", () => {
  before(async () => {
    await ensureWizardDraftUnificationSurface("denali");
  });

  it("WEB-WIZ-011-01 denali reads legacy nested title", () => {
    const draft = {
      data: {
        basicInfo: { title: "Legacy title" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title", "denali"), "Legacy title");
    assert.equal(
      readWizardDraftFieldDisplayString(draft, "text", "title", "denali"),
      "Legacy title"
    );
  });

  it("WEB-WIZ-011-02 starter bridges basics.title ↔ title", () => {
    const draft = {
      data: {
        basics: { title: "Starter basics title" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title", "starter"), "Starter basics title");
    assert.equal(
      readWizardDraftFieldDisplayString(draft, "text", "title", "starter"),
      "Starter basics title"
    );
  });

  it("WEB-WIZ-011-03 canonical path wins over legacy alias", () => {
    const draft = {
      data: {
        title: "Canonical",
        basicInfo: { title: "Legacy" },
      },
    } as TourWizardDraft;
    assert.equal(readWizardDraftFieldValue(draft, "title", "denali"), "Canonical");
  });
});
