import assert from "node:assert/strict";
import test from "node:test";

import { denaliCanonicalToForm } from "@repo/denali-domain";

import { buildDenaliTourCreateDefaultValues } from "../../src/features/tours/wizard/schemas/denaliCore.schema";
import {
  buildTourWizardTemplatePayloadFromForm,
  canonicalDataFromWizardForm,
} from "./tour-wizard-template-builder-form";

test("canonicalDataFromWizardForm keeps duration and itinerary from classified wizard form", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = denaliCanonicalToForm(
    {
      category: "mountain",
      duration: "multi",
      title: "Alpine trek",
      destinationId: defaults.basicInfo.destinationId,
      startDateTime: defaults.basicInfo.startDateTime,
      program: {
        themeIds: [],
        shortDescription: "Short",
        itinerary: [{ day: 1, activities: "Summit approach" }],
      },
      transport: { mode: "none" },
      pricing: { paymentMode: "offline_receipt" },
      participants: {},
      policies: { policiesText: "" },
    },
    defaults,
    {
      basics: { category: "mountain", duration: "multi_day", eventVariant: undefined },
    },
  );

  const canonical = canonicalDataFromWizardForm(form);

  assert.equal(canonical.duration, "multi");
  assert.equal(canonical.title, "Alpine trek");
  const itinerary = canonical.program?.itinerary;
  assert.ok(Array.isArray(itinerary) && itinerary.length === 1);
});

test("buildTourWizardTemplatePayloadFromForm persists wizard adapter canonical unchanged", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = denaliCanonicalToForm(
    {
      category: "mountain",
      duration: "multi",
      title: "Alpine trek",
      destinationId: defaults.basicInfo.destinationId,
      startDateTime: defaults.basicInfo.startDateTime,
      program: {
        themeIds: [],
        shortDescription: "Short",
        itinerary: [{ day: 1, activities: "Summit approach" }],
      },
      transport: { mode: "none" },
      pricing: { paymentMode: "offline_receipt" },
      participants: {},
      policies: { policiesText: "" },
    },
    defaults,
    {
      basics: { category: "mountain", duration: "multi_day", eventVariant: undefined },
    },
  );

  const payload = buildTourWizardTemplatePayloadFromForm(
    { fieldRulesOverlay: {} },
    ["title"],
    { canonicalData: canonicalDataFromWizardForm(form) },
  );

  const itinerary = (payload.canonicalData.program as { itinerary?: unknown[] })?.itinerary;
  assert.ok(Array.isArray(itinerary) && itinerary.length === 1);
  assert.equal(payload.canonicalData.duration, "multi");
});
