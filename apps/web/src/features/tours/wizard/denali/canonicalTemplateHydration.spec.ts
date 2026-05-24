import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

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
