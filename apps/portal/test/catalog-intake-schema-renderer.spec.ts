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

describe("catalog-intake-schema-renderer", () => {
  it("P8-SCH-01 denali intake step uses schema renderer only for fields", () => {
    const source = readFileSync(denaliIntakePath, "utf8");
    assert.match(source, /resolveEffectiveIntakeSchema/);
    assert.match(source, /RenderIntakeForm/);
    assert.doesNotMatch(source, /participantProfileFields/);
    assert.doesNotMatch(source, /resolveCatalogIntakeCapabilities/);
  });
});
