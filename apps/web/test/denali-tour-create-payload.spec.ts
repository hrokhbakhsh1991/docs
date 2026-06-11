/**
 * Denali tour create — canonical submit payload (11.8 submit hardening)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali";

import { loadDenaliWizardRulesModule } from "../src/bootstrap/denali-wizard-rules";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { setCanonicalStringValue, setCanonicalValue } from "../src/tours/tour-wizard-draft-path";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali/denali-wizard-ui-context";
import { tourWizardDraftToDenaliForm } from "../src/wizard/denali/denali-draft-form-adapter";
import {
  sanitizeLeaderUserIdsOnDraft,
  sanitizeThemeIdsOnDraft,
} from "../src/wizard/denali/denali-catalog-sanitize";
import { sanitizeDenaliWizardDraft } from "../src/wizard/denali/denali-draft-form-adapter";
import { prepareDenaliTourCreatePayload } from "../src/wizard/denali/denali-tour-create-payload";

describe("denali-tour-create-payload.spec.ts", () => {
  it("WEB-11.8-SUBMIT-01 builds canonical payload with roots and schemaVersion", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const plugin = getDenaliWorkspacePlugin();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "title", "Alborz day hike");
    draft = setCanonicalStringValue(draft, "category", "mountain_day");

    const payload = prepareDenaliTourCreatePayload(draft, plugin, rules, ctx);
    assert.equal(payload.schemaVersion, 1);
    assert.ok(Array.isArray(payload.roots));
    assert.ok((payload.roots ?? []).length > 0);
    const data = payload.data as Record<string, unknown>;
    assert.equal(data.title, "Alborz day hike");
    assert.equal(data.category, "mountain_day");
  });

  it("WEB-11.8-SUBMIT-02 filters stale gear then retains active items in canonical payload", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const plugin = getDenaliWorkspacePlugin();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalValue(draft, "participants.gearItems", [
      { equipmentId: "eq-active", name: "Poles", isRequired: true },
      { equipmentId: "eq-stale", name: "Rope", isRequired: false },
    ]);

    const payload = prepareDenaliTourCreatePayload(draft, plugin, rules, ctx, {
      activeEquipmentIds: ["eq-active"],
    });
    assert.equal(payload.schemaVersion, 1);
    const participants = (payload.data as Record<string, unknown>).participants as Record<
      string,
      unknown
    >;
    assert.ok(Array.isArray(participants.gearItems));
    const gearItems = participants.gearItems as Array<Record<string, unknown>>;
    assert.equal(gearItems.length, 1);
    assert.equal(gearItems[0]?.equipmentId, "eq-active");
  });

  it("WEB-11.8-SUBMIT-04 strips stale theme and leader ids before ingress", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalValue(draft, "program.themeIds", ["t-active", "t-stale"]);
    draft = setCanonicalValue(draft, "leaderUserIds", ["u-active", "u-stale"]);
    let next = sanitizeDenaliWizardDraft(draft, rules, ctx);
    next = sanitizeThemeIdsOnDraft(next, ["t-active"]);
    next = sanitizeLeaderUserIdsOnDraft(next, ["u-active"]);
    const form = tourWizardDraftToDenaliForm(next, rules) as {
      programNature: { themeIds: string[] };
      basicInfo: { leaderUserIds: string[] };
    };
    assert.deepEqual(form.programNature.themeIds, ["t-active"]);
    assert.deepEqual(form.basicInfo.leaderUserIds, ["u-active"]);
  });

  it("WEB-11.8-SUBMIT-03 clears ghost dong on submit after transport change", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const plugin = getDenaliWorkspacePlugin();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalStringValue(draft, "transport.mode", "shared_cars");
    draft = setCanonicalStringValue(draft, "transport.dongAmount", "50000");
    draft = setCanonicalStringValue(draft, "transport.mode", "bus");

    const payload = prepareDenaliTourCreatePayload(draft, plugin, rules, ctx);
    const transport = (payload.data as Record<string, unknown>).transport as Record<string, unknown>;
    assert.equal(transport.dongAmount, undefined);
  });
});
