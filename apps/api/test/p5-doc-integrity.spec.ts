/**
 * P5 — documentation integrity contract (cross-file sync)
 * @see TEMP/p5/DOC-SYNC-INDEX.md
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

const CANONICAL = {
  packVersion: "2.9-ai-friendly",
  currentTask: "P5-A-N-004",
  nanoTotal: "56",
  nanoDone: "3",
  exitCore: "P5-B-N-016",
  exitFull: "P5-E-N-006",
  agentPackScore: "9.95/10",
  docIntegrityScore: "9.9/10",
} as const;

const SYNC_FILES = [
  "TEMP/p5/DOC-SYNC-INDEX.md",
  "TEMP/p5/AGENT-START.md",
  "TEMP/p5/README.md",
  "TEMP/p5-exit-checklist.md",
  "TEMP/p5-enterprise-evolution.md",
  "TEMP/p5/AGENT-MANIFEST.yaml",
] as const;

describe("p5-doc-integrity (DOC-SYNC)", () => {
  it("DOC-SYNC-01 canonical index defines frozen fields", () => {
    const index = read("TEMP/p5/DOC-SYNC-INDEX.md");
    assert.match(index, /pack_version: 2\.9-ai-friendly/);
    assert.match(index, /current_task: P5-A-N-004/);
    assert.match(index, /nano_done: 3/);
    assert.match(index, /exit_core: P5-B-N-016/);
    assert.match(index, /agent_pack_score: 9\.95\/10/);
  });

  it("DOC-SYNC-02 agent entry files agree on task + exit", () => {
    for (const file of SYNC_FILES) {
      if (file === "TEMP/p5/DOC-SYNC-INDEX.md") continue;
      const text = read(file);
      assert.match(text, /P5-A-N-004/, `${file} missing current task`);
      assert.match(text, /P5-B-N-016/, `${file} missing exit_core`);
      assert.match(text, /P5-E-N-006/, `${file} missing exit_full`);
    }
  });

  it("DOC-SYNC-03 phase-18 core mdoc frontmatter links TEMP specs", () => {
    const cutover = read("docs/phase-18/platform-metadata-cutover-pilot.mdoc");
    const parity = read("docs/phase-18/platform-denali-operator-parity.mdoc");
    assert.match(cutover, /execution_spec: TEMP\/p5\/p5-a-cutover-pilot\.md/);
    assert.match(parity, /execution_spec: TEMP\/p5\/p5-b-denali-operator-parity\.md/);
    assert.match(cutover, /quality: 9\.9/);
    assert.match(parity, /quality: 9\.9/);
    assert.match(cutover, /deriveMetadataCutoverStage/);
  });

  it("DOC-SYNC-04 optional mdoc frontmatter present", () => {
    for (const file of [
      "docs/phase-18/platform-workspace-commerce.mdoc",
      "docs/phase-18/platform-integrations-plane.mdoc",
      "docs/phase-18/platform-registrations-finance-tranche.mdoc",
    ]) {
      const text = read(file);
      assert.match(text, /execution_spec: TEMP\/p5\//);
      assert.match(text, /optional: true/);
    }
  });

  it("DOC-SYNC-05 no stale denali git-diff gate in docs", () => {
    const e2e = read("docs/phase-17/platform-club-product-e2e.mdoc");
    const catalog = read("docs/phase-17/platform-club-catalog-publish.mdoc");
    const p4exit = read("TEMP/p4-exit-checklist.md");
    assert.doesNotMatch(e2e, /git diff --quiet packages\/workspaces\/denali/);
    assert.doesNotMatch(catalog, /git diff --quiet packages\/workspaces\/denali/);
    assert.doesNotMatch(p4exit, /git diff --quiet packages\/workspaces\/denali/);
    assert.match(p4exit, /guard:p3-denali-covenant/);
  });

  it("DOC-SYNC-06 completed nanos reflected in FILE-MAP", () => {
    const map = read("TEMP/p5/FILE-MAP.md");
    assert.match(map, /P5-A-N-001.*✅/);
    assert.match(map, /P5-A-N-002.*✅/);
    assert.match(map, /P5-A-N-003.*✅/);
    assert.match(map, /P5-A-N-004.*⬜/);
  });
});
