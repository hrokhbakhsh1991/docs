import assert from "node:assert/strict";
import test from "node:test";

import { resolveSettingsMetadataNamespace } from "../src/i18n/settings-page-metadata";

test("resolveSettingsMetadataNamespace maps equipment route to equipmentPage", () => {
  assert.equal(resolveSettingsMetadataNamespace("equipment"), "equipmentPage");
});

test("resolveSettingsMetadataNamespace passes through tourThemes", () => {
  assert.equal(resolveSettingsMetadataNamespace("tourThemes"), "tourThemes");
});
