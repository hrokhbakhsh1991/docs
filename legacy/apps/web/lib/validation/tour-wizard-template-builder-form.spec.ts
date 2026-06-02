import assert from "node:assert/strict";
import test from "node:test";

import { denaliCanonicalToForm } from "@repo/denali-domain";

import { buildDenaliTourCreateDefaultValues } from "../../src/features/tours/wizard/schemas/denaliCore.schema";
import {
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  canonicalDataFromWizardForm,
  mapOverlayValidationPathToFormPath,
  overlayRowRegistrationPath,
  parseOverlayValidationIssuePath,
  templateSeedRhfPath,
} from "./tour-wizard-template-builder-form";

test("overlayRowRegistrationPath uses bracket notation for dotted storage paths", () => {
  assert.equal(
    overlayRowRegistrationPath("overview.peakHeight", "visibility"),
    "fieldRulesOverlay[overview.peakHeight].visibility",
  );
  assert.equal(
    overlayRowRegistrationPath("title", "required"),
    "fieldRulesOverlay[title].required",
  );
});

test("templateSeedRhfPath maps storage paths to registry wizard RHF paths", () => {
  assert.equal(templateSeedRhfPath("title"), "basicInfo.title");
  assert.equal(templateSeedRhfPath("overview.peakHeight"), "tripDetails.overview.peakHeight");
  assert.equal(templateSeedRhfPath("duration"), "basicInfo.tourType");
});

test("parseOverlayValidationIssuePath resolves full dotted storage paths", () => {
  assert.deepEqual(parseOverlayValidationIssuePath("fieldRulesOverlay.overview.peakHeight.visibility"), {
    storagePath: "overview.peakHeight",
    prop: "visibility",
  });
  assert.deepEqual(parseOverlayValidationIssuePath("fieldRulesOverlay.program.themeIds.required"), {
    storagePath: "program.themeIds",
    prop: "required",
  });
  assert.deepEqual(parseOverlayValidationIssuePath("fieldRulesOverlay.title"), {
    storagePath: "title",
    prop: "visibility",
  });
});

test("mapOverlayValidationPathToFormPath maps overlay issues only", () => {
  assert.equal(mapOverlayValidationPathToFormPath("canonicalData.overview.peakHeight"), undefined);
  assert.equal(
    mapOverlayValidationPathToFormPath("fieldRulesOverlay.overview.peakHeight.visibility"),
    "fieldRulesOverlay[overview.peakHeight].visibility",
  );
});

test("buildTourWizardTemplateBuilderDefaults reads overlay only", () => {
  const defaults = buildTourWizardTemplateBuilderDefaults(
    {
      id: "tpl-1",
      fieldRulesOverlay: { title: { visibility: "always", required: "" } },
      canonicalData: { title: "Seed title", overview: { peakHeight: 3000 } },
    } as never,
    ["title", "overview.peakHeight"],
  );
  assert.equal(defaults.fieldRulesOverlay.title?.visibility, "always");
  assert.equal((defaults as { canonicalData?: unknown }).canonicalData, undefined);
});

test("buildTourWizardTemplatePayloadFromForm accepts Layer A from wizard adapter", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = denaliCanonicalToForm(
    {
      category: "mountain",
      duration: "single",
      title: "Saved",
      destinationId: defaults.basicInfo.destinationId,
      startDateTime: defaults.basicInfo.startDateTime,
      program: { themeIds: [], shortDescription: "Short" },
      transport: { mode: "none" },
      pricing: { paymentMode: "offline_receipt" },
      participants: {},
      policies: { policiesText: "" },
    },
    defaults,
    {
      basics: { category: "mountain", duration: "single_day", eventVariant: undefined },
    },
  );

  const canonicalData = canonicalDataFromWizardForm(form);
  const payload = buildTourWizardTemplatePayloadFromForm(
    {
      fieldRulesOverlay: {
        title: { visibility: "always", required: "" },
        "overview.peakHeight": { visibility: "hidden", required: "optional" },
      },
    },
    ["title", "overview.peakHeight"],
    { canonicalData },
  );

  assert.deepEqual(payload.fieldRulesOverlay, {
    title: { visibility: "always" },
    "overview.peakHeight": { visibility: "hidden", required: "optional" },
  });
  assert.equal(payload.canonicalData.title, "Saved");
  assert.equal(payload.canonicalData.duration, "single");
});
