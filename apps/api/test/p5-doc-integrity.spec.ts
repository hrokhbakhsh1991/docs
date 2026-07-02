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

function readCanonicalFromDocSyncIndex(): Record<string, string> {
  const index = read("TEMP/p5/DOC-SYNC-INDEX.md");
  const block = index.match(/```yaml\n([\s\S]*?)```/)?.[1];
  assert.ok(block, "DOC-SYNC-INDEX yaml block missing");
  const fields: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([a-z_]+):\s*(.+)$/);
    if (match) {
      fields[match[1]!] = match[2]!.trim();
    }
  }
  assert.ok(fields.current_task, "DOC-SYNC-INDEX missing current_task");
  assert.ok(fields.nano_done, "DOC-SYNC-INDEX missing nano_done");
  return fields;
}

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
    const canonical = readCanonicalFromDocSyncIndex();
    const index = read("TEMP/p5/DOC-SYNC-INDEX.md");
    assert.match(index, /pack_version: 2\.9-ai-friendly/);
    assert.match(index, new RegExp(`current_task: ${canonical.current_task}`));
    assert.match(index, new RegExp(`nano_done: ${canonical.nano_done}`));
    assert.match(index, /exit_core: P5-B-N-016/);
    assert.match(index, /agent_pack_score: 9\.95\/10/);
  });

  it("DOC-SYNC-02 agent entry files agree on task + exit", () => {
    const canonical = readCanonicalFromDocSyncIndex();
    for (const file of SYNC_FILES) {
      if (file === "TEMP/p5/DOC-SYNC-INDEX.md") continue;
      const text = read(file);
      assert.match(
        text,
        new RegExp(canonical.current_task!),
        `${file} missing current task ${canonical.current_task}`
      );
      assert.match(text, /P5-B-N-016/, `${file} missing exit_core`);
      assert.match(text, /P5-E-N-006/, `${file} missing exit_full`);
      assert.match(
        text,
        new RegExp(`nano_done: ${canonical.nano_done}`),
        `${file} missing nano_done ${canonical.nano_done}`
      );
    }
  });

  it("DOC-SYNC-03 phase-18 core mdoc frontmatter links TEMP specs", () => {
    const cutover = read("docs/phase-18/platform-metadata-cutover-pilot.mdoc");
    const parity = read("docs/phase-18/platform-denali-operator-parity.mdoc");
    const commerce = read("docs/phase-18/platform-workspace-commerce.mdoc");
    assert.match(cutover, /execution_spec: TEMP\/p5\/p5-a-cutover-pilot\.md/);
    assert.match(parity, /execution_spec: TEMP\/p5\/p5-b-denali-operator-parity\.md/);
    assert.match(parity, /Operator product preservation matrix \(DOC-B-02\)/);
    assert.match(parity, /Gap → owner map \(DOC-B-01/);
    assert.match(parity, /Nano ↔ gap map \(frozen — P5-B-N-002\)/);
    assert.match(parity, /Tour lifecycle FSM \(frozen — P5-B-N-003\)/);
    assert.match(parity, /Publish lifecycle gates \(frozen — P5-B-N-004\)/);
    assert.match(parity, /Draft vs publish validation \(frozen — P5-B-N-005\)/);
    assert.match(parity, /Golden metadata path \(frozen — P5-B-N-006\)/);
    assert.match(parity, /Form profile strip \(frozen — P5-B-N-007\)/);
    assert.match(parity, /Catalog ref integrity \(frozen — P5-B-N-008\)/);
    assert.match(parity, /Operator web plugin resolve \(frozen — P5-B-N-009\)/);
    assert.match(parity, /Publish integration metadata path \(frozen — P5-B-N-010\)/);
    assert.match(parity, /PATCH audit \(frozen — P5-B-N-011\)/);
    assert.match(parity, /Publish audit \(frozen — P5-B-N-012\)/);
    assert.match(parity, /Client\/server rules parity \(frozen — P5-B-N-013\)/);
    assert.match(commerce, /Denali scope \(frozen — P5-C-N-001 DOC-C-01\)/);
    assert.match(commerce, /Commerce schema \(frozen — P5-C-N-002\)/);
    assert.match(commerce, /Persistence on publish \(frozen — P5-C-N-003\)/);
    assert.match(commerce, /Tenant binding inherit \(frozen — P5-C-N-004\)/);
    assert.match(commerce, /Tour create default \(frozen — P5-C-N-005\)/);
    assert.match(commerce, /Super Admin commerce badge \(frozen — P5-C-N-006\)/);
    assert.match(commerce, /Commerce guards \(frozen — P5-C-N-007\.\.009\)/);
    assert.match(commerce, /tour-create-commerce-gateway-blocked\.spec\.ts/);
    assert.match(commerce, /execution_spec: TEMP\/p5\/p5-c-workspace-commerce-config\.md/);
    assert.match(cutover, /quality: 9\.9/);
    assert.match(parity, /quality: 9\.9/);
    assert.match(cutover, /deriveMetadataCutoverStage/);
    assert.match(cutover, /Staging pilot env \(frozen — P5-A-N-005 DOC-02\)/);
    assert.match(cutover, /Allowlist expand runbook \(frozen — P5-A-N-010 DOC-03\)/);
    assert.match(cutover, /G2 async validation ingress \(frozen — P5-A-N-011 DOC-04\)/);
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
    const surfaces = read("docs/phase-17/platform-club-product-surfaces.mdoc");
    assert.doesNotMatch(e2e, /git diff --quiet packages\/workspaces\/denali/);
    assert.doesNotMatch(catalog, /git diff --quiet packages\/workspaces\/denali/);
    assert.doesNotMatch(surfaces, /git diff --quiet packages\/workspaces\/denali/);
    assert.match(e2e, /guard:p3-denali-covenant/);
  });

  it("DOC-SYNC-06 completed nanos reflected in FILE-MAP", () => {
    const map = read("TEMP/p5/FILE-MAP.md");
    assert.match(map, /P5-A-N-001.*✅/);
    assert.match(map, /P5-A-N-002.*✅/);
    assert.match(map, /P5-A-N-003.*✅/);
    assert.match(map, /P5-A-N-004.*✅/);
    assert.match(map, /P5-A-N-005.*✅/);
    assert.match(map, /P5-A-N-006.*✅/);
    assert.match(map, /P5-A-N-007.*✅/);
    assert.match(map, /P5-A-N-008.*✅/);
    assert.match(map, /P5-A-N-009.*✅/);
    assert.match(map, /P5-A-N-010.*✅/);
    assert.match(map, /P5-A-N-011.*✅/);
    assert.match(map, /P5-A-N-012.*✅/);
    assert.match(map, /P5-B-N-001.*✅/);
    assert.match(map, /P5-B-N-002.*✅/);
    assert.match(map, /P5-B-N-003.*✅/);
    assert.match(map, /P5-B-N-004.*✅/);
    assert.match(map, /P5-B-N-005.*✅/);
    assert.match(map, /P5-B-N-006.*✅/);
    assert.match(map, /P5-B-N-007.*✅/);
    assert.match(map, /P5-B-N-008.*✅/);
    assert.match(map, /P5-B-N-009.*✅/);
    assert.match(map, /P5-B-N-010.*✅/);
    assert.match(map, /P5-B-N-011.*✅/);
    assert.match(map, /P5-B-N-012.*✅/);
    assert.match(map, /P5-B-N-013.*✅/);
    assert.match(map, /P5-B-N-014.*✅/);
    assert.match(map, /P5-B-N-015.*✅/);
    assert.match(map, /P5-B-N-016.*✅/);
    assert.match(map, /P5-C-N-001.*✅/);
    assert.match(map, /P5-C-N-002.*✅/);
    assert.match(map, /P5-C-N-003.*✅/);
    assert.match(map, /P5-C-N-004.*✅/);
    assert.match(map, /P5-C-N-005.*✅/);
    assert.match(map, /P5-C-N-006.*✅/);
    assert.match(map, /P5-C-N-007.*✅/);
    assert.match(map, /P5-C-N-008.*✅/);
    assert.match(map, /P5-C-N-009.*✅/);
    assert.match(map, /P5-C-N-010.*✅/);
    assert.match(map, /P5-D-N-001.*✅/);
    for (let n = 2; n <= 10; n += 1) {
      assert.match(map, new RegExp(`P5-D-N-${String(n).padStart(3, "0")}.*✅`));
    }
    for (let n = 1; n <= 6; n += 1) {
      assert.match(map, new RegExp(`P5-E-N-${String(n).padStart(3, "0")}.*✅`));
    }
  });
});
