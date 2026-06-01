import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  canonicalSeedRegistrationPath,
  mapOverlayValidationPathToFormPath,
  overlayRowRegistrationPath,
  packCanonicalFormValuesToTemplateData,
  parseOverlayValidationIssuePath,
  readCanonicalNestedValue,
  unpackCanonicalTemplateToFormValues,
  writeCanonicalNestedValue,
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

test("canonicalSeedRegistrationPath uses bracket notation for dotted storage paths", () => {
  assert.equal(
    canonicalSeedRegistrationPath("overview.peakHeight"),
    "canonicalData[overview.peakHeight]",
  );
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

test("mapOverlayValidationPathToFormPath maps canonical and overlay issues", () => {
  assert.equal(
    mapOverlayValidationPathToFormPath("canonicalData.overview.peakHeight"),
    "canonicalData[overview.peakHeight]",
  );
  assert.equal(
    mapOverlayValidationPathToFormPath("fieldRulesOverlay.overview.peakHeight.visibility"),
    "fieldRulesOverlay[overview.peakHeight].visibility",
  );
});

test("unpack and pack round-trip nested canonical storage paths", () => {
  const canonical = {
    title: "Alpine trek",
    overview: { peakHeight: 4200 },
    program: { themeIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"] },
  };
  const flat = unpackCanonicalTemplateToFormValues(canonical, [
    "title",
    "overview.peakHeight",
    "program.themeIds",
  ]);
  assert.equal(flat.title, "Alpine trek");
  assert.equal(flat["overview.peakHeight"], 4200);
  assert.deepEqual(flat["program.themeIds"], ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);

  const packed = packCanonicalFormValuesToTemplateData(flat);
  assert.deepEqual(packed, canonical);
});

test("readCanonicalNestedValue and writeCanonicalNestedValue dot-walk", () => {
  const root: Record<string, unknown> = {};
  writeCanonicalNestedValue(root, "transport.mode", "bus");
  assert.equal(readCanonicalNestedValue(root, "transport.mode"), "bus");
});

test("buildTourWizardTemplateBuilderDefaults unpacks canonical JSONB into flat seed map", () => {
  const defaults = buildTourWizardTemplateBuilderDefaults(
    {
      id: "tpl-1",
      fieldRulesOverlay: { title: { visibility: "always" } },
      canonicalData: { title: "Seed title", overview: { peakHeight: 3000 } },
    } as never,
    ["title", "overview.peakHeight"],
  );
  assert.equal(defaults.canonicalData.title, "Seed title");
  assert.equal(defaults.canonicalData["overview.peakHeight"], 3000);
});

test("buildTourWizardTemplatePayloadFromForm reads flat dotted overlay keys only", () => {
  const payload = buildTourWizardTemplatePayloadFromForm(
    {
      fieldRulesOverlay: {
        title: { visibility: "always", required: "" },
        "overview.peakHeight": { visibility: "hidden", required: "optional" },
        overview: {
          peakHeight: { visibility: "active", required: "" },
        },
      },
      canonicalData: {
        title: "Saved",
        "overview.peakHeight": 4100,
      },
    },
    ["title", "overview.peakHeight", "program.themeIds"],
  );

  assert.deepEqual(payload.fieldRulesOverlay, {
    title: { visibility: "always" },
    "overview.peakHeight": { visibility: "hidden", required: "optional" },
  });
  assert.deepEqual(payload.canonicalData, {
    title: "Saved",
    overview: { peakHeight: 4100 },
  });
});
