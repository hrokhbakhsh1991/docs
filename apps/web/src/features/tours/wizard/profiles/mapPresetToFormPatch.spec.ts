import assert from "node:assert/strict";
import test from "node:test";

import { mapPresetToFormPatch } from "./mapPresetToFormPatch";

test("mapPresetToFormPatch: denali_pilot uses 6-tab roots", () => {
  const patch = mapPresetToFormPatch(
    "denali_pilot",
    { basicInfo: { title: "denali preset name", tourType: "mountain_day" } },
    { matchTourType: "mountain_day" },
  );
  assert.equal((patch as { basicInfo?: { title?: string } }).basicInfo?.title, "denali preset name");
  assert.equal((patch as { overview?: unknown }).overview, undefined);
});

test("mapPresetToFormPatch: classic profile uses overview roots", () => {
  const patch = mapPresetToFormPatch("mountain_outdoor", {
    overview: { title: "classic title here", tourType: "mountain" },
  });
  assert.equal((patch as { overview?: { title?: string } }).overview?.title, "classic title here");
});
