import assert from "node:assert/strict";
import test from "node:test";

import { denaliCanonicalToForm } from "@repo/denali-domain";

import { buildDenaliTourCreateDefaultValues } from "../../src/features/tours/wizard/schemas/denaliCore.schema";
import {
  buildTourWizardTemplatePayloadFromForm,
  packTemplateCanonicalForPersist,
} from "./tour-wizard-template-builder-form";

test("packTemplateCanonicalForPersist keeps duration and itinerary from preview form", () => {
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

  const leftFlat = {
    category: "mountain",
    duration: "single",
    title: "Left title override ignored when preview classified",
  };

  const packed = packTemplateCanonicalForPersist(form, leftFlat);

  assert.equal(packed.duration, "multi");
  assert.equal(packed.title, "Alpine trek");
  const itinerary = (packed.program as { itinerary?: unknown[] })?.itinerary;
  assert.ok(Array.isArray(itinerary) && itinerary.length === 1);
});

test("buildTourWizardTemplatePayloadFromForm preserves preview itinerary via canonicalLayerA", () => {
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

  const canonicalLayerA = packTemplateCanonicalForPersist(form, { category: "mountain" });
  const payload = buildTourWizardTemplatePayloadFromForm(
    { fieldRulesOverlay: {}, canonicalData: {} },
    ["title"],
    { canonicalLayerA },
  );

  const itinerary = (payload.canonicalData.program as { itinerary?: unknown[] })?.itinerary;
  assert.ok(Array.isArray(itinerary) && itinerary.length === 1);
  assert.equal(payload.canonicalData.duration, "multi");
});

test("packTemplateCanonicalForPersist applies left-panel duration when preview lacks tourType", () => {
  const packed = packTemplateCanonicalForPersist(null, {
    category: "mountain",
    duration: "single",
    title: "Seed only",
    "program.shortDescription": "Brief",
  });

  assert.equal(packed.category, "mountain");
  assert.equal(packed.duration, "single");
  assert.equal(packed.title, "Seed only");
});
