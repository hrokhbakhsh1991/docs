import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCreatedRow,
  appendGearSelection,
  mergeConfirmedRows,
} from "../src/ui/logic/quick-add.ts";

const equipment = { id: "13f855df-7347-4a4b-81b6-92625ae9aa88", name: "Helmet" };
const existing = { equipmentId: "old", name: "Rope", isRequired: true };

test("rejects malformed response and preserves supplied destination validation context", () => {
  assert.equal(parseCreatedRow("equipment", { ...equipment, name: "   " }), null);
  assert.equal(parseCreatedRow("equipment", { ...equipment, id: "not-a-uuid" }), null);
  assert.deepEqual(parseCreatedRow("equipment", equipment), equipment);
  const regionId = "25aca03a-a3fc-41a5-9def-3f8190650e04";
  const destination = { ...equipment, name: "Trail", regionId, locationType: "nature_trail" };
  assert.deepEqual(parseCreatedRow("destination", destination, regionId), destination);
  assert.equal(parseCreatedRow("destination", destination, "different-region"), null);
  assert.equal(
    parseCreatedRow("destination", { ...destination, locationType: "invented" }, regionId),
    null
  );
});

test("appends gear without replacing current selections and preserves requirement on repeated response", () => {
  const current = [existing];
  const next = appendGearSelection(current, equipment, false);
  assert.deepEqual(next, [
    existing,
    { equipmentId: equipment.id, name: "Helmet", isRequired: false },
  ]);
  assert.strictEqual(appendGearSelection(next, equipment, true), next);
  assert.deepEqual(current, [existing]);
});

test("keeps a confirmed create when GET is late and uses authoritative row when observed", () => {
  const before = [{ id: "existing", name: "Existing" }];
  const after = { ...equipment, name: "Renamed in authoritative read" };
  assert.deepEqual(mergeConfirmedRows(before, [equipment]), [...before, equipment]);
  assert.deepEqual(mergeConfirmedRows([...before, after], [equipment]), [...before, after]);
});

test("keeps all returned metadata, rejecting incomplete catalog resources", async () => {
  const { parseCreatedCatalogResource } = await import("../src/ui/logic/quick-add.ts");
  const regionId = "25aca03a-a3fc-41a5-9def-3f8190650e04";
  const destination = {
    ...equipment,
    regionId,
    locationType: "peak",
    altitudeM: 4000,
    typicalTrailDistanceKm: null,
    isActive: true,
    sortOrder: 2,
  };
  const gear = { ...equipment, category: null, themeIds: [], sortOrder: 0, iconKey: "helmet" };
  assert.strictEqual(
    parseCreatedCatalogResource("destination", destination, regionId),
    destination
  );
  assert.equal(
    parseCreatedCatalogResource("destination", { ...destination, altitudeM: "4000" }, regionId),
    null
  );
  assert.strictEqual(parseCreatedCatalogResource("equipment", gear), gear);
  assert.equal(parseCreatedCatalogResource("equipment", equipment), null);
});

test("a resolved result can only select into the unchanged mounted draft", async () => {
  const { canApplyQuickAddResult } = await import("../src/ui/logic/quick-add.ts");
  const original = { data: { category: "nature" } };
  const replacement = { data: { category: "nature" } };
  assert.equal(canApplyQuickAddResult(true, original, original), true);
  assert.equal(canApplyQuickAddResult(true, original, replacement), false);
  assert.equal(canApplyQuickAddResult(false, original, original), false);
});

test("destination metrics accept localized numbers and reject wrong units or invalid values", async () => {
  const { parseQuickAddMetric } = await import("../src/ui/logic/quick-add.ts");
  assert.equal(parseQuickAddMetric("", false), undefined);
  assert.equal(parseQuickAddMetric("۴۰۰۰", false), 4000);
  assert.equal(parseQuickAddMetric("١٢٫٥", true), 12.5);
  assert.equal(parseQuickAddMetric("1.5", false), null);
  assert.equal(parseQuickAddMetric("-1", true), null);
  assert.equal(parseQuickAddMetric("1e2", true), null);
});

test("authoritative observation retires a confirmed overlay, so later deletes stay deleted", async () => {
  const { retireObservedRows } = await import("../src/ui/logic/quick-add.ts");
  const unknown = { id: "another", name: "Another" };
  const overlay = [equipment, unknown];
  assert.strictEqual(retireObservedRows(overlay, new Set()), overlay);
  const retired = retireObservedRows(overlay, new Set([equipment.id]));
  assert.deepEqual(retired, [unknown]);
  assert.deepEqual(mergeConfirmedRows([], retired), [unknown]);
});
