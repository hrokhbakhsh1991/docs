import assert from "node:assert/strict";
import test from "node:test";

import { FormRuleEngine } from "./formRuleEngine";
import { LookupRegistry } from "./lookupRegistry";
import type { RuleConfig } from "./types";

type TestForm = {
  basicInfo: { tourType: string; destinationId: string };
  filters: { regionId: string };
};

const DESTINATION_PATH = "basicInfo.destinationId";
const TOUR_TYPE_PATH = "basicInfo.tourType";
const REGION_PATH = "filters.regionId";

function createEngine(
  form: TestForm,
  registry: LookupRegistry,
  searchImpl: (query: {
    searchText: string;
    dependencyValues: Record<string, unknown>;
  }) => Promise<{ items: { id: string; name: string }[] }>,
) {
  const rules: RuleConfig<TestForm>[] = [
    {
      path: DESTINATION_PATH,
      lookupProvider: "destination.search",
      dependencies: [TOUR_TYPE_PATH, REGION_PATH],
      required: true,
    },
  ];

  registry.register("destination.search", async (query) => {
    return searchImpl({
      searchText: query.searchText,
      dependencyValues: query.dependencyValues,
    });
  });

  return new FormRuleEngine<TestForm>({
    rules,
    registry,
    getFormValues: () => form,
  });
}

test("LookupRegistry rejects unknown provider at search time", async () => {
  const registry = new LookupRegistry();
  await assert.rejects(
    () =>
      registry.search("missing", {
        providerId: "missing",
        fieldPath: "x",
        searchText: "",
        form: {},
        dependencyValues: {},
      }),
    /unknown provider/,
  );
});

test("dependency change triggers autocomplete refetch with new dependency snapshot", async () => {
  const form: TestForm = {
    basicInfo: { tourType: "mountain_day", destinationId: "" },
    filters: { regionId: "region-a" },
  };

  const calls: Array<{ searchText: string; regionId: unknown }> = [];
  const registry = new LookupRegistry();
  const engine = createEngine(form, registry, async ({ searchText, dependencyValues }) => {
    calls.push({ searchText, regionId: dependencyValues[REGION_PATH] });
    return {
      items: [{ id: "d1", name: `dest-${String(dependencyValues[REGION_PATH])}` }],
    };
  });

  await engine.refetchLookup(DESTINATION_PATH, "teh");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.regionId, "region-a");

  form.filters.regionId = "region-b";
  const refetched = await engine.handleFieldChange(REGION_PATH);
  assert.deepEqual(refetched, [DESTINATION_PATH]);

  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.regionId, "region-b");
  assert.equal(calls[1]?.searchText, "teh");

  const state = engine.getLookupState(DESTINATION_PATH);
  assert.equal(state?.status, "success");
  assert.equal(state?.items[0]?.name, "dest-region-b");
});

test("dependency change with unchanged snapshot does not refetch", async () => {
  const form: TestForm = {
    basicInfo: { tourType: "mountain_day", destinationId: "" },
    filters: { regionId: "region-a" },
  };

  let calls = 0;
  const registry = new LookupRegistry();
  const engine = createEngine(form, registry, async () => {
    calls += 1;
    return { items: [] };
  });

  await engine.refetchLookup(DESTINATION_PATH, "");
  assert.equal(calls, 1);

  const refetched = await engine.handleFieldChange(TOUR_TYPE_PATH);
  assert.deepEqual(refetched, []);
  assert.equal(calls, 1);
});

test("lookup field searchText change refetches only that field", async () => {
  const form: TestForm = {
    basicInfo: { tourType: "mountain_day", destinationId: "" },
    filters: { regionId: "region-a" },
  };

  const searchTexts: string[] = [];
  const registry = new LookupRegistry();
  const engine = createEngine(form, registry, async ({ searchText }) => {
    searchTexts.push(searchText);
    return { items: [] };
  });

  await engine.handleFieldChange(DESTINATION_PATH, { searchText: "da" });
  await engine.handleFieldChange(DESTINATION_PATH, { searchText: "dam" });

  assert.deepEqual(searchTexts, ["da", "dam"]);
});

test("subscribeLookup receives loading and success states (UI-agnostic)", async () => {
  const form: TestForm = {
    basicInfo: { tourType: "mountain_day", destinationId: "" },
    filters: { regionId: "region-a" },
  };

  const registry = new LookupRegistry();
  const engine = createEngine(form, registry, async () => ({
    items: [{ id: "1", name: "Alborz" }],
  }));

  const statuses: string[] = [];
  engine.subscribeLookup(DESTINATION_PATH, (state) => {
    statuses.push(state.status);
  });

  await engine.refetchLookup(DESTINATION_PATH, "al");
  assert.deepEqual(statuses, ["idle", "loading", "success"]);
});
