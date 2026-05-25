import assert from "node:assert/strict";
import test from "node:test";

import { resolvePublicSiteConfig } from "./resolve-public-site-config";

test("resolvePublicSiteConfig: denali tenant uses denali workspace and wizard mode", () => {
  const config = resolvePublicSiteConfig("denali");
  assert.equal(config.contentWorkspace, "denali");
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
