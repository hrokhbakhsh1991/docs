import assert from "node:assert/strict";
import test from "node:test";

import { denaliTemplateOrchestratorFactory } from "../rules/factory/DenaliTemplateOrchestratorFactory";
import { buildDenaliTourCreateDefaultValues } from "../schemas/denaliCore.schema";

import { tryHydrateCanonicalTemplate } from "./canonicalTemplateHydration";

test("tryHydrateCanonicalTemplate applies canonical patch through rule engine", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const hydrated = tryHydrateCanonicalTemplate(
    {
      category: "mountain",
      duration: "single",
      title: "Template tour",
      program: { shortDescription: "Short", themeIds: [] },
    },
    defaults,
  );

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.title, "Template tour");
  assert.equal(hydrated.formValues.programNature.shortDescription, "Short");
});

test("tryHydrateCanonicalTemplate retains program.itinerary on single-day mountain templates", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const hydrated = tryHydrateCanonicalTemplate(
    {
      category: "mountain",
      duration: "single",
      title: "Single-day with itinerary seed",
      program: {
        shortDescription: "Short",
        themeIds: [],
        itinerary: [{ day: 1, activities: "Day one activities" }],
      },
    },
    defaults,
  );

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.programNature.itinerary?.[0]?.activities, "Day one activities");
});

test("denaliTemplateOrchestratorFactory retains itinerary through full factory pipeline", async () => {
  const result = await denaliTemplateOrchestratorFactory.createDraftFromTemplate({
    workspaceId: "ws-test",
    templateId: "tpl-test",
    canonicalData: {
      category: "mountain",
      duration: "single",
      title: "Factory itinerary",
      program: {
        shortDescription: "Short",
        themeIds: [],
        itinerary: [{ day: 1, activities: "Factory day one" }],
      },
    },
    fieldRulesOverlay: {},
  });

  assert.equal(result.success, true);
  const form = (result.draftState.data as { form?: { programNature?: { itinerary?: Array<{ activities?: string }> } } })
    .form;
  assert.equal(form?.programNature?.itinerary?.[0]?.activities, "Factory day one");
});

test("tryHydrateCanonicalTemplate leaves tourType unselected when patch omits classification", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const hydrated = tryHydrateCanonicalTemplate(
    {
      title: "Title-only template",
      program: { shortDescription: "Short", themeIds: [] },
    },
    defaults,
  );

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.title, "Title-only template");
  assert.equal(hydrated.formValues.basicInfo.tourType, defaults.basicInfo.tourType);
  assert.equal(hydrated.formValues.programNature.shortDescription, "Short");
});
