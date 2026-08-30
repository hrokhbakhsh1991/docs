/**
 * P8 — schema-driven intake renderer contract (plugin-owned steps).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const denaliIntakePath = join(
  repoRoot,
  "packages/workspaces/denali/src/catalog/registration-flow/denali-registration-flow.steps.tsx"
);
const urbanIntakePath = join(
  repoRoot,
  "packages/workspaces/urban/src/catalog/registration-flow/urban-registration-flow.steps.tsx"
);

describe("catalog-intake-schema-renderer", () => {
  it("P8-SCH-01 denali intake step uses schema renderer only for fields", () => {
    const source = readFileSync(denaliIntakePath, "utf8");
    assert.match(source, /resolveEffectiveIntakeSchema/);
    assert.match(source, /DenaliRenderIntakeForm/);
    assert.match(source, /idPrefix="denali-intake-self"/);
    assert.match(source, /idPrefix=\{`denali-intake-other-\$\{guestIdx\}`\}/);
    assert.match(source, /invalidFieldId/);
    assert.doesNotMatch(source, /hasError=\{error !== null\}/);
    assert.doesNotMatch(source, /participantProfileFields/);
    assert.doesNotMatch(source, /resolveCatalogIntakeCapabilities/);
  });

  it("P8-SCH-02 urban intake uses a single idPrefix and does not blanket-invalid", () => {
    const urban = readFileSync(urbanIntakePath, "utf8");
    assert.match(urban, /idPrefix="urban-intake"/);
    assert.doesNotMatch(urban, /hasError=\{error !== null\}/);
  });

  it("P8-SCH-03 catalog registration copy splits national-id format vs checksum", () => {
    const fa = readFileSync(join(repoRoot, "apps/portal/messages/fa/catalogRegistration.json"), "utf8");
    const en = readFileSync(join(repoRoot, "apps/portal/messages/en/catalogRegistration.json"), "utf8");
    assert.match(fa, /"nationalIdChecksumInvalid"/);
    assert.match(en, /"nationalIdChecksumInvalid"/);
  });
});
