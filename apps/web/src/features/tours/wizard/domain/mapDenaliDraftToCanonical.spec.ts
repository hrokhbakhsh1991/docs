import assert from "node:assert/strict";
import test from "node:test";

import { mapDenaliDraftToCanonical } from "./mapDenaliDraftToCanonical";
import { mapDenaliWizardToDraftPayload } from "./mapDenaliWizardToDraftPayload";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

test("mapDenaliDraftToCanonical: strips undefined keys to match JSON wire shape", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  const raw = mapDenaliWizardToDraftPayload(form).canonical;

  assert.ok("endDateTime" in raw);
  const normalized = mapDenaliDraftToCanonical(raw);
  assert.equal("endDateTime" in normalized, false);
});
