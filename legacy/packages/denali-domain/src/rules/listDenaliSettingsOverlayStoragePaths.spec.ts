import assert from "node:assert/strict";
import test from "node:test";

import { listDenaliRuleFieldPaths } from "./denaliRuleModel";
import { listDenaliSettingsOverlayStoragePaths } from "./listDenaliSettingsOverlayStoragePaths";
import { parseFieldRulesOverlay } from "./templateOverlay";

const GHOST_OVERLAY_PATHS = [
  "publishStatus",
  "startPointLocationText",
  "pricing.paymentMode",
  "transport.transportNotes",
  "transport.seatPreference",
] as const;

test("listDenaliSettingsOverlayStoragePaths returns unique section-bound storage paths", () => {
  const paths = listDenaliSettingsOverlayStoragePaths();
  assert.equal(paths.length, 51);
  assert.equal(new Set(paths).size, paths.length);
  assert.equal(paths.includes("eventVariant"), false);
});

test("listDenaliSettingsOverlayStoragePaths aligns with rule-model path count and includes duration", () => {
  const paths = listDenaliSettingsOverlayStoragePaths();
  assert.equal(paths.length, listDenaliRuleFieldPaths().length);
  assert.equal(paths.includes("duration"), true);
});

test("listDenaliSettingsOverlayStoragePaths excludes ghost and deprecated overlay paths", () => {
  const paths = new Set(listDenaliSettingsOverlayStoragePaths());
  for (const ghost of GHOST_OVERLAY_PATHS) {
    assert.equal(paths.has(ghost), false, ghost);
  }
  assert.equal(paths.has("meetingPoint"), false);
  assert.equal(paths.has("gatheringPoint"), false);
});

test("parseFieldRulesOverlay silently ignores legacy ghost overlay keys", () => {
  const map = parseFieldRulesOverlay({
    title: { visibility: "always" },
    publishStatus: { required: "required" },
    "pricing.paymentMode": { visibility: "hidden" },
    "transport.transportNotes": { required: "optional" },
    startPointLocationText: { visibility: "always" },
  });
  assert.equal(map.size, 1);
  assert.deepEqual(map.get("title"), { visibility: "always" });
});
