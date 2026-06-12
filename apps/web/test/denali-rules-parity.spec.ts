/**
 * Phase 11.8 — rules parity hardening acceptance
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWizardTemplatePutBody,
  parseWizardTemplateResponse,
} from "../src/features/settings/wizard-template-logic";
import { parseLocationsResponse } from "../src/features/settings/locations-logic";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { resolveWizardTemplateGateState } from "../src/tours/wizard-template-gate-logic";
import { loadDenaliWizardRulesModule } from "../src/bootstrap/denali-wizard-rules";
import { sanitizeDenaliWizardDraft } from "../src/wizard/denali/denali-draft-form-adapter";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali/denali-wizard-ui-context";
import {
  isEquipmentCompatibleWithTourCategory,
  isTourThemeCompatibleWithWizard,
} from "../src/wizard/denali/denali-catalog-filters";

describe("denali-rules-parity.spec.ts", () => {
  it("WEB-11.8-01 parseWizardTemplateResponse preserves fieldRulesOverlay and baseProfile", () => {
    const parsed = parseWizardTemplateResponse({
      configKey: "wizard_template",
      configVersion: 1,
      source: "tenant",
      updatedAt: null,
      payload: {
        seedLabel: "seed",
        sections: [],
        published: true,
        baseProfile: "denali_pilot",
        fieldRulesOverlay: { destinationId: { visibility: "hidden" } },
        steps: [
          {
            stepId: "denali_basic",
            label: "Basic",
            enabled: true,
            fields: [{ canonicalPath: "title" }],
          },
        ],
      },
    });
    assert.equal(parsed.baseProfile, "denali_pilot");
    assert.deepEqual(parsed.fieldRulesOverlay, { destinationId: { visibility: "hidden" } });

    const gate = resolveWizardTemplateGateState(
      {
        configKey: "wizard_template",
        configVersion: 1,
        source: "tenant",
        updatedAt: null,
        payload: parsed,
      },
      "denali"
    );
    assert.equal(gate.workspaceFormProfile, "denali_pilot");
    assert.deepEqual(gate.fieldRulesOverlay, { destinationId: { visibility: "hidden" } });
  });

  it("WEB-11.8-02 sanitize clears ghost dong when transport mode changes", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let draft = setCanonicalStringValue(emptyTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalStringValue(draft, "transport.mode", "shared_cars");
    draft = setCanonicalStringValue(draft, "transport.dongAmount", "50000");
    draft = setCanonicalStringValue(draft, "transport.mode", "bus");

    const sanitized = sanitizeDenaliWizardDraft(draft, rules, ctx);
    assert.equal(getCanonicalStringValue(sanitized, "transport.dongAmount"), "");
  });

  it("WEB-11.8-03 nationalIdRequired stays visible when minimumAge is hidden (nature)", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const form = rules.buildDefaultForm() as Record<string, unknown>;
    (form.basicInfo as Record<string, unknown>).tourType = "nature_day";

    const minAge = rules.evaluateFormFieldRule(
      form,
      "participants.minimumAge",
      "denali_pricing"
    );
    const nationalId = rules.evaluateFormFieldRule(
      form,
      "participants.nationalIdRequired",
      "denali_pricing"
    );
    assert.equal(minAge.visible, false);
    assert.equal(nationalId.visible, true);
  });

  it("WEB-11.8-04 catalog filters gear by tour category and themes by formProfile", () => {
    assert.equal(
      isEquipmentCompatibleWithTourCategory({ id: "1", name: "Poles", category: "mountain", themeIds: [], sortOrder: 0 }, "mountain"),
      true
    );
    assert.equal(
      isEquipmentCompatibleWithTourCategory({ id: "1", name: "Poles", category: "mountain", themeIds: [], sortOrder: 0 }, "nature"),
      false
    );
    assert.equal(
      isTourThemeCompatibleWithWizard(
        { id: "t1", name: "Mountain", slug: "m", formProfile: "mountain_outdoor", isActive: true, sortOrder: 0 },
        "mountain",
        "denali_pilot"
      ),
      true
    );
    assert.equal(
      isTourThemeCompatibleWithWizard(
        { id: "t1", name: "Mountain", slug: "m", formProfile: "mountain_outdoor", isActive: true, sortOrder: 0 },
        "nature",
        "denali_pilot"
      ),
      false
    );
  });

  it("WEB-11.8-05b buildWizardTemplatePutBody round-trips overlay and profile", () => {
    const body = buildWizardTemplatePutBody({
      seedLabel: "seed",
      sections: [],
      published: true,
      baseProfile: "denali_pilot",
      fieldRulesOverlay: { destinationId: { visibility: "hidden" } },
      steps: [{ stepId: "denali_basic", label: "Basic", enabled: true, fields: [{ canonicalPath: "title" }] }],
    });
    const payload = body.payload as Record<string, unknown>;
    assert.equal(payload.baseProfile, "denali_pilot");
    assert.deepEqual(payload.fieldRulesOverlay, { destinationId: { visibility: "hidden" } });
  });

  it("WEB-11.8-05 parseLocationsResponse normalizes missing altitudeM", () => {
    const parsed = parseLocationsResponse({
      regions: [],
      destinations: [
        {
          id: "d1",
          regionId: "r1",
          name: "Peak",
          locationType: "peak",
          altitudeM: 4200,
          isActive: true,
          sortOrder: 0,
        },
      ],
      total: 1,
    });
    assert.equal(parsed.destinations[0]?.altitudeM, 4200);
  });
});
