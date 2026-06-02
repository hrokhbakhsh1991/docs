import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicSiteConfig } from "./resolve-public-site-config";

test("resolvePublicSiteConfig: outdoor pilot profile uses outdoor_pilot workspace and denali wizard mode", () => {
  const config = resolvePublicSiteConfig("mountain-club", { tourFormProfile: "denali_pilot" });
  assert.equal(config.contentWorkspace, "outdoor_pilot");
  assert.equal(config.tourFormProfile, "denali_pilot");
  assert.equal(config.wizard.wizardMode, "denali");
  assert.equal(config.pages.landing.pageKey, "landing");
  assert.equal(config.catalog.listPath, "/catalog");
});

test("resolvePublicSiteConfig: unknown slug falls back to general", () => {
  const config = resolvePublicSiteConfig("unknown-brand");
  assert.equal(config.contentWorkspace, "general");
  assert.equal(config.tourFormProfile, "general");
  assert.equal(config.wizard.wizardMode, "classic");
});
