import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliCreateTourPayloadProjection } from "./buildDenaliCreateTourPayloadProjection";
import { mapDenaliWizardToCreateTourPayload } from "./mapDenaliWizardToCreateTourPayload";
import { mapDenaliWizardToDraftPayload } from "./mapDenaliWizardToDraftPayload";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import { denaliCanonicalTourSchema } from "@/features/tours/wizard/schemas/denaliCanonicalTourSchema.unified";

test("mapDenaliWizardToDraftPayload: uses same canonical engine as create-tour projection", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const draft = mapDenaliWizardToDraftPayload(form);
  const projection = buildDenaliCreateTourPayloadProjection(form);

  assert.equal(draft.canonical.category, "mountain");
  assert.equal(projection.tourType, "mountain");
  assert.equal(draft.canonical.title.trim(), projection.title.trim());
  assert.equal(draft.canonical.destinationId, projection.destinationId);
  assert.equal(draft.canonical.capacityMax, projection.capacity);

  const parsed = denaliCanonicalTourSchema.safeParse(draft.canonical);
  assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
});

test("mapDenaliWizardToDraftPayload: create mapper still builds API DTO from same form", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const dto = mapDenaliWizardToCreateTourPayload(form);
  const draft = mapDenaliWizardToDraftPayload(form);

  assert.equal(dto.tourType, "mountain");
  assert.equal(draft.canonical.category, "mountain");
  assert.ok(draft.canonical.title.length > 0);
});

test("mapDenaliWizardToDraftPayload: throws when tourType missing (same as create pipeline)", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = undefined;

  assert.throws(
    () => mapDenaliWizardToDraftPayload(form),
    /basicInfo\.tourType is required/,
  );
  assert.throws(
    () => mapDenaliWizardToCreateTourPayload(form),
    /basicInfo\.tourType is required/,
  );
});
