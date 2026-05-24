import assert from "node:assert/strict";
import test from "node:test";

import { LookupRegistry } from "@repo/shared";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { createDenaliFormRuleEngine } from "./createDenaliFormRuleEngine";
import { LOOKUP_PROVIDER_IDS } from "./lookupProviderIds";

test("createDenaliFormRuleEngine registers destination.search and refetches on tourType change", async () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  const registry = new LookupRegistry();
  const fetchCalls: string[] = [];
  registry.register(LOOKUP_PROVIDER_IDS.destinationSearch, async (query) => {
    const tourType = query.dependencyValues["basicInfo.tourType"];
    fetchCalls.push(String(tourType));
    if (tourType === "event_cinema") {
      return { items: [] };
    }
    return { items: [{ id: "d1", name: "Test", regionId: "region-1" }] };
  });

  const engine = createDenaliFormRuleEngine({
    getFormValues: () => form,
    registry,
  });

  await engine.refetchLookup("basicInfo.destinationId", "");
  assert.equal(fetchCalls.length, 1);

  form.basicInfo.tourType = "event_cinema";
  const refetched = await engine.handleFieldChange("basicInfo.tourType");
  assert.deepEqual(refetched, ["basicInfo.destinationId"]);
  assert.equal(fetchCalls.length, 2);

  const state = engine.getLookupState("basicInfo.destinationId");
  assert.equal(state?.status, "success");
  assert.equal(state?.items.length, 0, "event tours filter destinations to empty");
});

test("createDenaliFormRuleEngine evaluates file field requiredness", () => {
  const form = buildDenaliTourCreateTestValues();
  form.participantRequirements.sportsInsuranceRequired = false;

  const engine = createDenaliFormRuleEngine({
    getFormValues: () => form,
    registry: new LookupRegistry(),
  });

  assert.equal(engine.evaluateField("photosData.photos").required, false);
  form.participantRequirements.sportsInsuranceRequired = true;
  assert.equal(engine.evaluateField("photosData.photos").required, true);
});
