/**
 * P5 — anti-drift static contract (agent pack)
 * @see TEMP/p5/ANTI-DRIFT.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("p5-anti-drift-contract", () => {
  it("AD-C-01 ANTI-DRIFT catalog defines S0 stop patterns", () => {
    const doc = readFileSync(join(repoRoot, "TEMP/p5/ANTI-DRIFT.md"), "utf8");
    assert.match(doc, /AD-S0-01/);
    assert.match(doc, /AD-S0-06/);
    assert.match(doc, /denali\/src\/rules/);
  });

  it("AD-C-02 derive cutover stage avoids new DB column", () => {
    const source = readFileSync(
      join(repoRoot, "apps/api/src/workspace-metadata/derive-metadata-cutover-stage.ts"),
      "utf8"
    );
    assert.match(source, /MetadataCutoverStage/);
    assert.doesNotMatch(source, /prisma/i);
  });

  it("AD-C-03 epic B spec forbids rules deletion shortcut", () => {
    const spec = readFileSync(
      join(repoRoot, "TEMP/p5/p5-b-denali-operator-parity.md"),
      "utf8"
    );
    assert.match(spec, /Do \*\*not\*\* edit.*denali\/src\/rules/);
  });

  it("AD-C-04 optional EPICs marked in manifest", () => {
    const manifest = readFileSync(join(repoRoot, "TEMP/p5/AGENT-MANIFEST.yaml"), "utf8");
    assert.match(manifest, /epic_optional:\n- P5-C\n- P5-D\n- P5-E/);
  });
});
