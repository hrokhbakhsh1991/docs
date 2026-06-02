import assert from "node:assert/strict";
import test from "node:test";

import {
  collectWorkspaceWizardTemplatePublishErrors,
  collectWorkspaceWizardTemplateValidationErrors,
} from "./validate-workspace-wizard-template";

const PARTIAL_MOUNTAIN_SINGLE = {
  category: "mountain",
  duration: "single",
  title: "Draft-only tour title",
} as const;

test("collectWorkspaceWizardTemplateValidationErrors flags invalid overlay enums", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    fieldRulesOverlay: { title: { visibility: "maybe", required: "mandatory" } },
  });
  assert.ok(errors.some((e) => e.path === "fieldRulesOverlay.title.visibility"));
  assert.ok(errors.some((e) => e.path === "fieldRulesOverlay.title.required"));
});

test("collectWorkspaceWizardTemplateValidationErrors flags unknown canonical keys", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    canonicalData: { totallyUnknownRoot: true },
  });
  assert.ok(errors.some((e) => e.path.startsWith("canonicalData")));
});

test("save validation accepts partial canonical seeds missing publish-required fields", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    fieldRulesOverlay: {},
    canonicalData: { ...PARTIAL_MOUNTAIN_SINGLE },
  });
  assert.equal(errors.length, 0);
});

test("publish validation fails closed when canonical content is empty", () => {
  const errors = collectWorkspaceWizardTemplatePublishErrors({}, {});

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.path, "canonicalData");
  assert.equal(errors[0]?.code, "VALIDATION_PUBLISH_HYDRATION_FAILED");
});

test("publish validation rejects partial canonical missing capacity and schedule seeds", () => {
  const errors = collectWorkspaceWizardTemplatePublishErrors({}, { ...PARTIAL_MOUNTAIN_SINGLE });

  assert.ok(errors.length > 0);
  assert.ok(
    errors.every(
      (error) =>
        error.code === "VALIDATION_REQUIRED_FIELD_MISSING" ||
        error.code === "VALIDATION_PUBLISH_HYDRATION_FAILED",
    ),
    "publish gate must emit required-field or hydration failure codes",
  );
  assert.ok(
    errors.some((error) => error.path === "canonicalData.basicInfo.capacityMax"),
    "capacityMax must block publish",
  );
  assert.ok(
    errors.some((error) => error.path === "canonicalData.basicInfo.startDateTime"),
    "startDateTime must block publish",
  );
});

test("publish validation rejects blank title with field-level canonical path", () => {
  const errors = collectWorkspaceWizardTemplatePublishErrors(
    {},
    {
      category: "mountain",
      duration: "single",
      title: "   ",
    },
  );

  assert.ok(
    errors.some(
      (error) =>
        error.path === "canonicalData.basicInfo.title" &&
        error.code === "VALIDATION_REQUIRED_FIELD_MISSING",
    ),
  );
});

test("publish validation uses overlay-merged ruleSet for requiredness", () => {
  const saveErrors = collectWorkspaceWizardTemplateValidationErrors({
    fieldRulesOverlay: { destinationId: { required: "required" } },
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Tour with missing destination",
    },
  });
  assert.equal(saveErrors.length, 0);

  const publishErrors = collectWorkspaceWizardTemplatePublishErrors(
    { destinationId: { required: "required" } },
    {
      category: "mountain",
      duration: "single",
      title: "Tour with missing destination",
    },
  );

  assert.ok(
    publishErrors.some((error) => error.path === "canonicalData.basicInfo.destinationId"),
    "overlay-required destinationId must block publish",
  );
});

test("publish validation rejects registry-deprecated ghost keys before hydration", () => {
  const errors = collectWorkspaceWizardTemplatePublishErrors(
    {},
    {
      category: "mountain",
      duration: "single",
      title: "Tour with ghost logistics text",
      startPointLocationText: "legacy ghost",
    },
  );

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.path, "canonicalData.startPointLocationText");
  assert.equal(errors[0]?.code, "VALIDATION_DEPRECATED_FIELDS_IN_PUBLISH");
});

test("save validation still accepts deprecated ghost keys when publish is not requested", () => {
  const errors = collectWorkspaceWizardTemplateValidationErrors({
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Draft-only ghost",
      startPointLocationText: "legacy ghost",
    },
  });
  assert.equal(errors.length, 0);
});
