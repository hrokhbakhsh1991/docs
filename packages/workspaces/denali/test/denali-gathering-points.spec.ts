import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { applyDenaliStructuralInvariants } from "../src/normalize/structuralInvariants";
import { buildDenaliTourCreateDefaultValues } from "../src/schemas/denaliCore.schema";
import {
  createEmptyDenaliGatheringPoint,
  isDenaliGatheringPointPopulated,
  omitEmptyDenaliGatheringPoints,
  resolveDenaliGatheringPointsEditorState,
  resolveDenaliGatheringPointsFromStorage,
} from "../src/ui/logic/denali-location-types";

const FIELD_SRC = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../src/ui/fields/denali-gathering-points-field.tsx"),
  "utf8"
);

describe("denali-gathering-points.spec.ts", () => {
  it("ED-GATHER-01 empty scaffold is display-only and not populated", () => {
    const empty = createEmptyDenaliGatheringPoint(true);
    assert.equal(isDenaliGatheringPointPopulated(empty), false);
    assert.deepEqual(omitEmptyDenaliGatheringPoints([empty, { name: "  " }]), []);
    const editor = resolveDenaliGatheringPointsEditorState([]);
    assert.equal(editor.scaffold, true);
    assert.equal(editor.points.length, 1);
  });

  it("ED-GATHER-01 keeps populated stations and stamps a primary", () => {
    const kept = omitEmptyDenaliGatheringPoints([
      { name: "" },
      { name: "میدان تجریش", address: "تجریش" },
    ]);
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.isPrimary, true);
    assert.equal(kept[0]?.name, "میدان تجریش");
  });

  it("ED-GATHER-01 field does not seed an empty station into the draft on mount", () => {
    assert.equal(/useEffect/.test(FIELD_SRC), false);
    assert.match(FIELD_SRC, /data-gathering-scaffold/);
  });

  it("ED-GATHER-01 invariant strips empty gathering rows before persist", () => {
    const form = buildDenaliTourCreateDefaultValues();
    form.tripDetails.logistics.gatheringPoints = [createEmptyDenaliGatheringPoint(true)];
    const next = applyDenaliStructuralInvariants(form);
    assert.deepEqual(next.tripDetails.logistics.gatheringPoints, []);
  });

  it("ED-GATHER-PERSIST-01 populated root wins over nested logistics", () => {
    const resolved = resolveDenaliGatheringPointsFromStorage(
      [{ name: "root station", isPrimary: true }],
      [{ name: "nested station", address: "دربند" }]
    );
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0]?.name, "root station");
  });

  it("ED-GATHER-PERSIST-01 empty root falls back to populated nested", () => {
    const resolved = resolveDenaliGatheringPointsFromStorage([], [
      { name: "میدان دربند", address: "دربند، تهران", isPrimary: true },
    ]);
    assert.equal(resolved[0]?.name, "میدان دربند");
    assert.equal(resolved[0]?.address, "دربند، تهران");
  });

  it("ED-GATHER-PERSIST-01 field writes canonical gatheringPoints and mirrors nested", () => {
    assert.match(FIELD_SRC, /DENALI_GATHERING_POINTS_CANONICAL_PATH/);
    assert.match(FIELD_SRC, /DENALI_GATHERING_POINTS_NESTED_PATH/);
    assert.match(FIELD_SRC, /setCanonicalValue\(withRoot, DENALI_GATHERING_POINTS_NESTED_PATH/);
  });

  it("ED-GATHER-PERSIST-01 OSM pick fills empty name from displayName", () => {
    assert.match(FIELD_SRC, /osmName/);
    assert.match(FIELD_SRC, /currentName\.length === 0 && osmName\.length > 0/);
    const picker = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/ui/components/denali-location-address-picker.tsx"),
      "utf8"
    );
    assert.match(picker, /osmName: item\.displayName/);
    assert.match(picker, /address: item\.addressText/);
  });
});
