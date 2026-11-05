import assert from "node:assert/strict";
import { it } from "node:test";
import { resolveTourPreset, readPresetMatchingConfig } from "../src/tours/resolve-tour-preset";
import type { PresetsAdvancedPayload } from "../src/features/settings/presets-advanced-types";
import { setCanonicalValue } from "../src/tours/tour-wizard-draft-path";
const presets = ["first", "second", "fallback"].map((id) => ({
  id,
  tenantId: "qa",
  name: id,
  description: null,
  themeId: null,
  isActive: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
}));
const rule = (presetId: string) => ({
  id: presetId,
  tourType: "mountain_day",
  themeId: "mountain",
  presetId,
  enabled: true,
});
const config: PresetsAdvancedPayload = {
  autoMatchEnabled: true,
  defaultPresetId: "fallback",
  matchRules: [rule("first"), rule("second")],
};
const draft = setCanonicalValue(
  setCanonicalValue({ data: {} }, "category", "mountain_day"),
  "program.themeIds",
  ["mountain"]
);
const input = { tenantId: "qa", presetId: null, presets, config, draft };
it("explicit preset wins; invalid explicit selection does not silently choose another", () => {
  assert.equal(resolveTourPreset({ ...input, presetId: "second" })?.id, "second");
  assert.equal(resolveTourPreset({ ...input, presetId: "missing" }), null);
});
it("first enabled rule requires all its conditions; unmatched rules fall back", () => {
  assert.equal(resolveTourPreset(input)?.id, "first");
  assert.equal(
    resolveTourPreset({
      ...input,
      config: { ...config, matchRules: [{ ...rule("first"), enabled: false }, rule("second")] },
    })?.id,
    "second"
  );
  assert.equal(resolveTourPreset({ ...input, draft: { data: {} } })?.id, "fallback");
  assert.equal(
    resolveTourPreset({ ...input, draft: setCanonicalValue(draft, "category", "other") })?.id,
    "fallback"
  );
  assert.equal(
    resolveTourPreset({ ...input, draft: setCanonicalValue(draft, "program.themeIds", []) })?.id,
    "fallback"
  );
});
it("disabled auto match and inactive destinations never apply", () => {
  assert.equal(
    resolveTourPreset({ ...input, config: { ...config, autoMatchEnabled: false } }),
    null
  );
  assert.equal(
    resolveTourPreset({ ...input, presets: presets.map((p) => ({ ...p, isActive: false })) }),
    null
  );
});
it("malformed settings fail closed", () => {
  for (const value of [
    null,
    {},
    [],
    { ...config, matchRules: [null] },
    { ...config, defaultPresetId: 7 },
    { ...config, matchRules: [{ ...rule("first"), enabled: "false" }] },
  ])
    assert.equal(readPresetMatchingConfig(value), null);
  assert.deepEqual(readPresetMatchingConfig(config), config);
});
