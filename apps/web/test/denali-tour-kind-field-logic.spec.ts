/**
 * Denali tour kind UI — canonical slug vs matrix fallback + collapsible panel logic.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { applyDenaliDefaultTourKind } from "@app-tour/workspace-denali/ui/logic/denali-default-tour-kind";
import {
  isDenaliTourKindChoiceActive,
  isDenaliTourKindSelectionComplete,
  rebaseCategoryDraftChangeOntoLatest,
  rebaseDraftChangeOntoLatest,
  resolveDenaliTourKindPickerOpen,
  resolveDenaliTourKindSummaryParts,
  resolveDenaliTourKindUiBasics,
} from "@app-tour/workspace-denali/ui/logic/denali-tour-kind-field-logic";
import { sanitizeDenaliWizardDraft } from "@app-tour/workspace-denali/ui/chrome/draft-form-adapter";
import { buildDenaliWizardRuleEvalContext } from "@app-tour/workspace-denali/wizard/submit";
import { loadDenaliWizardRulesModule } from "@app-tour/workspace-denali/wizard/rules-loader";

describe("denali-tour-kind-field-logic.spec.ts", () => {
  it("DWC-TK-01 empty draft has no tour kind selection (no fake mountain/single_day)", () => {
    const draft = emptyTourWizardDraft();
    const slug = getCanonicalStringValue(draft, "category");
    const ui = resolveDenaliTourKindUiBasics(slug);

    assert.equal(slug, "");
    assert.equal(ui.hasSelection, false);
    assert.equal(ui.basics, null);
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.category, "mountain"), false);
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.duration, "single_day"), false);
    assert.equal(resolveDenaliTourKindPickerOpen(ui.hasSelection), true);
  });

  it("DWC-TK-02 default create draft shows mountain + single_day summary parts", () => {
    const slug = getCanonicalStringValue(applyDenaliDefaultTourKind(emptyTourWizardDraft()), "category");
    const ui = resolveDenaliTourKindUiBasics(slug);

    assert.equal(ui.hasSelection, true);
    assert.deepEqual(ui.basics, { category: "mountain", duration: "single_day" });
    assert.deepEqual(resolveDenaliTourKindSummaryParts(ui.basics), ["category", "duration"]);
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.category, "mountain"), true);
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.duration, "single_day"), true);
    assert.equal(resolveDenaliTourKindPickerOpen(ui.hasSelection), true);
    assert.equal(isDenaliTourKindSelectionComplete(ui.hasSelection, ui.basics), true);
  });

  it("DWC-TK-03 persisted slug drives active category and duration", () => {
    const draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "nature_day");
    const ui = resolveDenaliTourKindUiBasics(getCanonicalStringValue(draft, "category"));

    assert.equal(ui.hasSelection, true);
    assert.deepEqual(ui.basics, { category: "nature", duration: "single_day" });
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.category, "nature"), true);
    assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.category, "mountain"), false);
  });

  it("DWC-TK-04 event slug summary includes event variant part", () => {
    const ui = resolveDenaliTourKindUiBasics("event_cinema_multi");
    assert.deepEqual(ui.basics, {
      category: "event",
      duration: "multi_day",
      eventVariant: "cinema",
    });
    assert.deepEqual(resolveDenaliTourKindSummaryParts(ui.basics), [
      "category",
      "duration",
      "eventVariant",
    ]);
    assert.equal(isDenaliTourKindSelectionComplete(ui.hasSelection, ui.basics), true);
  });

  it("DWC-TK-05 sanitize keeps category after explicit selection", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "desert_multi");
    draft = setCanonicalStringValue(draft, "title", "Sahara trek");

    const sanitized = sanitizeDenaliWizardDraft(draft, rules, ctx);
    assert.equal(getCanonicalStringValue(sanitized, "category"), "desert_multi");
    assert.equal(getCanonicalStringValue(sanitized, "title"), "Sahara trek");
    assert.equal(getCanonicalStringValue(sanitized, "duration"), "");
    assert.equal(getCanonicalStringValue(sanitized, "eventVariant"), "");
  });

  it("DWC-TK-06 rebaseCategoryDraftChangeOntoLatest preserves latest title", () => {
    const latest = setCanonicalStringValue(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Typed title"),
      "category",
      "mountain_day"
    );
    const stale = setCanonicalStringValue(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Stale"),
      "category",
      "nature_day"
    );
    const rebased = rebaseCategoryDraftChangeOntoLatest(latest, stale);
    assert.equal(getCanonicalStringValue(rebased, "category"), "nature_day");
    assert.equal(getCanonicalStringValue(rebased, "title"), "Typed title");
  });

  it("DWC-TK-07 rebaseDraftChangeOntoLatest preserves latest when category unchanged", () => {
    const latest = setCanonicalStringValue(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Latest title"),
      "category",
      "mountain_day"
    );
    const stale = setCanonicalStringValue(
      setCanonicalStringValue(emptyTourWizardDraft(), "title", "Stale partial"),
      "category",
      "mountain_day"
    );
    const rebased = rebaseDraftChangeOntoLatest(latest, stale);
    assert.equal(getCanonicalStringValue(rebased, "category"), "mountain_day");
    assert.equal(getCanonicalStringValue(rebased, "title"), "Stale partial");
  });
});
