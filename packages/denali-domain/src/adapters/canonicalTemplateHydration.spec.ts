import assert from "node:assert/strict";
import test from "node:test";

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
