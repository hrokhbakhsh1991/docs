import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("field exposure Playwright closure contract (9.7)", () => {
  it("documents Phase 9.7 Playwright spec and script", () => {
    const doc = readFileSync(
      join(repoRoot, "docs/architecture/field-exposure-system.md"),
      "utf8",
    );
    assert.match(doc, /Phase 9\.7 — Playwright exposure settings/);
    assert.match(doc, /denali-exposure-settings\.spec\.ts/);
    assert.match(doc, /test:e2e:exposure/);
  });

  it("wires dedicated Playwright config for exposure settings smoke", () => {
    const config = readFileSync(
      join(repoRoot, "apps/web/playwright.exposure.config.ts"),
      "utf8",
    );
    assert.match(config, /denali-exposure-settings\.spec\.ts/);
    assert.match(config, /SMK-EXP/);
  });

  it("uses exposure test ids without locale-prefixed settings links", () => {
    const spec = readFileSync(
      join(repoRoot, "apps/web/tests/e2e/denali-exposure-settings.spec.ts"),
      "utf8",
    );
    assert.match(spec, /SETTINGS_HUB_TEST_IDS\.exposurePage/);
    assert.match(spec, /DENALI_WORKSPACE_SURFACES_TEST_IDS/);
    assert.match(spec, /href="\/settings\/integrations"/);
    assert.doesNotMatch(spec, /\/\$\{locale\}\/settings/);
  });
});
